// SPDX-License-Identifier: GPL-3.0-only
import { open, readdir } from 'node:fs/promises';
import path from 'node:path';

const normalizeTitle = (title) =>
  title.normalize('NFKC').trim().toLowerCase().replace(/\s+/gu, ' ');
export function matchSteamTitle(title, games) {
  const requested = normalizeTitle(title);
  const exact = games.filter((game) => normalizeTitle(game.name) === requested);
  const [first, ...others] = exact;
  return first && others.every(({ appId }) => appId === first.appId) ? first : null;
}

async function readVdf(file, maxBytes) {
  let handle;
  try {
    handle = await open(file, 'r');
    const buffer = Buffer.alloc(maxBytes + 1);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    return bytesRead <= maxBytes ? buffer.toString('utf8', 0, bytesRead) : '';
  } catch {
    return '';
  } finally {
    await handle?.close();
  }
}

export function isSteamExecutable(file) {
  return Boolean(
    file &&
      path.isAbsolute(file) &&
      !/^[\\/]{2}/u.test(file) &&
      path.basename(file).toLowerCase() === 'steam.exe',
  );
}

export async function readSteamLibraries(steamExecutable) {
  if (!isSteamExecutable(steamExecutable)) return [];
  const steamRoot = path.normalize(path.dirname(steamExecutable));
  const libraryFile = path.join(steamRoot, 'steamapps', 'libraryfolders.vdf');
  const folders = await readVdf(libraryFile, 256 * 1024);
  const libraryKey = (library) => library;
  const libraryRoots = new Map([[libraryKey(steamRoot), steamRoot]]);
  for (const [, value] of folders.matchAll(/^\s*"path"\s+"([^"\r\n]+)"/gmu)) {
    const library = value.replace(/\\\\/gu, '\\');
    if (path.isAbsolute(library) && !/^[\\/]{2}/u.test(library)) {
      const full = path.normalize(library);
      libraryRoots.set(libraryKey(full), full);
    }
    if (libraryRoots.size === 32) break;
  }
  return [...libraryRoots.values()];
}

export async function readSteamManifest(library, appId) {
  if (!/^\d{1,10}$/u.test(appId)) return null;
  const manifest = await readVdf(
    path.join(library, 'steamapps', `appmanifest_${appId}.acf`),
    64 * 1024,
  );
  const field = (key) =>
    manifest
      .match(new RegExp(`^\\s*"${key}"\\s+"((?:[^"\\\\\\r\\n]|\\\\.)*)"`, 'mu'))?.[1]
      ?.replace(/\\(["\\])/gu, '$1');
  if (field('appid') !== appId || !field('name')) return null;
  const folder = field('installdir');
  const installPath =
    folder && /^[^\\/:*?"<>|]+$/u.test(folder) && folder !== '.' && folder !== '..'
      ? path.join(library, 'steamapps', 'common', folder)
      : null;
  return {
    appId,
    name: field('name'),
    library,
    installPath,
    installed: Boolean(Number(field('StateFlags')) & 4),
    downloading: Number(field('BytesToDownload')) > Number(field('BytesDownloaded') ?? 0),
  };
}

export async function resolveSteamLibraryGame(steamExecutable, title, signal, libraries = null) {
  const games = [];
  for (const library of libraries ?? (await readSteamLibraries(steamExecutable))) {
    signal?.throwIfAborted();
    const steamapps = path.join(library, 'steamapps');
    const files = await readdir(steamapps, { withFileTypes: true }).catch(() => []);
    const manifests = files
      .filter((file) => file.isFile() && /^appmanifest_\d{1,10}\.acf$/u.test(file.name))
      .slice(0, 4096);
    for (let offset = 0; offset < manifests.length; offset += 32) {
      signal?.throwIfAborted();
      const batch = await Promise.all(
        manifests.slice(offset, offset + 32).map(({ name }) => {
          const appId = name.slice('appmanifest_'.length, -'.acf'.length);
          return readSteamManifest(library, appId);
        }),
      );
      games.push(...batch.filter(Boolean));
    }
  }
  signal?.throwIfAborted();
  const match = matchSteamTitle(title, games);
  if (!match) return null;
  const copies = games.filter(({ appId }) => appId === match.appId);
  return copies.find((game) => game.installed) ?? copies.find((game) => game.downloading) ?? match;
}
