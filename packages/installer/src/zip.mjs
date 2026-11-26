// SPDX-License-Identifier: GPL-3.0-only
// Safe ZIP extraction (stored and deflate, ZIP64), replacing the PowerShell
// Expand-CapriArchive helper. Rules carried over from it:
//   - no absolute paths, `.`/`..` segments, control characters or symlink entries;
//   - every target stays inside the destination and appears only once;
//   - the total expansion is budgeted before anything is written;
//   - existing links on target paths are refused;
//   - byte-identical existing files are left untouched (safe for in-use runtimes).
import { createReadStream, createWriteStream, lstatSync, mkdirSync, writeFileSync } from 'node:fs';
import { chmod, open, readFile } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';
import { createInflateRaw, crc32 } from 'node:zlib';

const EOCD = 0x06054b50;
const ZIP64_LOCATOR = 0x07064b50;
const ZIP64_EOCD = 0x06064b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;
const S_IFMT = 0o170000;
const S_IFLNK = 0o120000;

function zipError(message) {
  return Object.assign(new Error(message), { code: 'CAPRI_UNSAFE_ARCHIVE' });
}

async function readAt(handle, position, length) {
  const buffer = Buffer.alloc(length);
  const { bytesRead } = await handle.read(buffer, 0, length, position);
  if (bytesRead !== length) throw zipError('Truncated archive.');
  return buffer;
}

/** The central directory entries of an archive. */
export async function readZipEntries(archive) {
  const handle = await open(archive, 'r');
  try {
    const { size } = await handle.stat();
    const tailLength = Math.min(size, 65557);
    const tail = await readAt(handle, size - tailLength, tailLength);
    let end = -1;
    for (let i = tail.length - 22; i >= 0; i--)
      if (tail.readUInt32LE(i) === EOCD) {
        end = i;
        break;
      }
    if (end < 0) throw zipError('Not a ZIP archive.');
    let count = tail.readUInt16LE(end + 10);
    let directorySize = tail.readUInt32LE(end + 12);
    let directoryOffset = tail.readUInt32LE(end + 16);
    if (end >= 20 && tail.readUInt32LE(end - 20) === ZIP64_LOCATOR) {
      const record = await readAt(handle, Number(tail.readBigUInt64LE(end - 12)), 56);
      if (record.readUInt32LE(0) !== ZIP64_EOCD) throw zipError('Invalid ZIP64 record.');
      count = Number(record.readBigUInt64LE(32));
      directorySize = Number(record.readBigUInt64LE(40));
      directoryOffset = Number(record.readBigUInt64LE(48));
    }
    if (count > 100000 || directorySize > 64 * 1024 ** 2) throw zipError('Archive is too large.');
    const directory = await readAt(handle, directoryOffset, directorySize);
    const entries = [];
    for (let at = 0, index = 0; index < count; index++) {
      if (directory.readUInt32LE(at) !== CENTRAL) throw zipError('Invalid central directory.');
      const flags = directory.readUInt16LE(at + 8);
      const method = directory.readUInt16LE(at + 10);
      const crc = directory.readUInt32LE(at + 16);
      let compressedSize = directory.readUInt32LE(at + 20);
      let uncompressedSize = directory.readUInt32LE(at + 24);
      const nameLength = directory.readUInt16LE(at + 28);
      const extraLength = directory.readUInt16LE(at + 30);
      const commentLength = directory.readUInt16LE(at + 32);
      const madeBy = directory.readUInt16LE(at + 4) >> 8;
      const external = directory.readUInt32LE(at + 38);
      let localOffset = directory.readUInt32LE(at + 42);
      const name = directory.toString(
        flags & 0x0800 ? 'utf8' : 'latin1',
        at + 46,
        at + 46 + nameLength,
      );
      // ZIP64 extended information replaces saturated 32-bit fields, in order.
      const extra = directory.subarray(at + 46 + nameLength, at + 46 + nameLength + extraLength);
      for (let e = 0; e + 4 <= extra.length; ) {
        const id = extra.readUInt16LE(e);
        const length = extra.readUInt16LE(e + 2);
        if (id === 0x0001) {
          let field = e + 4;
          const next = () => {
            const value = Number(extra.readBigUInt64LE(field));
            field += 8;
            return value;
          };
          if (uncompressedSize === 0xffffffff) uncompressedSize = next();
          if (compressedSize === 0xffffffff) compressedSize = next();
          if (localOffset === 0xffffffff) localOffset = next();
        }
        e += 4 + length;
      }
      entries.push({
        name,
        method,
        crc,
        encrypted: Boolean(flags & 1),
        compressedSize,
        uncompressedSize,
        localOffset,
        // Unix mode lives in the high 16 bits when the entry was made on Unix (3).
        mode: madeBy === 3 ? external >>> 16 : 0,
        directory: name.endsWith('/'),
      });
      at += 46 + nameLength + extraLength + commentLength;
    }
    return entries;
  } finally {
    await handle.close();
  }
}

function safeTarget(root, name) {
  const parts = name.replace(/\/$/, '').split('/');
  if (
    !name ||
    name.startsWith('/') ||
    name.includes('\\') ||
    /[\x00-\x1f]/.test(name) ||
    parts.some((part) => part === '' || part === '.' || part === '..')
  )
    throw zipError('Unsafe archive entry.');
  const target = path.resolve(root, ...parts);
  if (!target.startsWith(root + path.sep)) throw zipError('Archive path escapes its folder.');
  return target;
}

function refuseLinks(target, root) {
  for (let cursor = target; cursor.startsWith(root + path.sep); cursor = path.dirname(cursor)) {
    const info = lstatSync(cursor, { throwIfNoEntry: false });
    if (info?.isSymbolicLink() || (info?.isFile() && info.nlink > 1))
      throw zipError('Archive target is a link.');
  }
}

async function identical(target, entry) {
  const info = lstatSync(target, { throwIfNoEntry: false });
  if (!info?.isFile() || info.size !== entry.uncompressedSize) return false;
  return crc32(await readFile(target)) >>> 0 === entry.crc;
}

/**
 * Extract `archive` into `destination`. `accept(name)` may narrow the allowed
 * entries (return false to reject the archive).
 */
export async function extractZip(
  archive,
  destination,
  { maximumBytes = 20 * 1024 ** 3, accept = () => true, signal } = {},
) {
  const root = path.resolve(destination);
  mkdirSync(root, { recursive: true });
  const entries = await readZipEntries(archive);
  const seen = new Set();
  let total = 0;
  const plan = entries.map((entry) => {
    if (entry.encrypted || ![0, 8].includes(entry.method))
      throw zipError('Unsupported archive entry.');
    if ((entry.mode & S_IFMT) === S_IFLNK) throw zipError('Archive contains a link.');
    if (!accept(entry.name)) throw zipError('Unexpected archive entry.');
    const target = safeTarget(root, entry.name);
    if (seen.has(target)) throw zipError('Archive duplicates an entry.');
    seen.add(target);
    total += entry.uncompressedSize;
    if (total > maximumBytes) throw zipError('Archive exceeds its expansion budget.');
    refuseLinks(target, root);
    return { entry, target };
  });
  const handle = await open(archive, 'r');
  try {
    for (const { entry, target } of plan) {
      signal?.throwIfAborted();
      if (entry.directory) {
        mkdirSync(target, { recursive: true });
        continue;
      }
      mkdirSync(path.dirname(target), { recursive: true });
      refuseLinks(target, root);
      if (await identical(target, entry)) continue;
      if (entry.uncompressedSize === 0) {
        writeFileSync(target, '');
        continue;
      }
      const local = await readAt(handle, entry.localOffset, 30);
      if (local.readUInt32LE(0) !== LOCAL) throw zipError('Invalid local header.');
      const start = entry.localOffset + 30 + local.readUInt16LE(26) + local.readUInt16LE(28);
      let crc = 0;
      let written = 0;
      const check = new Transform({
        transform(chunk, _encoding, done) {
          crc = crc32(chunk, crc);
          written += chunk.length;
          done(
            written > entry.uncompressedSize ? zipError('Archive entry size mismatch.') : null,
            chunk,
          );
        },
      });
      const source = createReadStream(null, {
        fd: handle.fd,
        autoClose: false,
        start,
        end: start + entry.compressedSize - 1,
      });
      const inflate = entry.method === 8 ? [createInflateRaw()] : [];
      await pipeline(source, ...inflate, check, createWriteStream(target), { signal });
      if (written !== entry.uncompressedSize || (crc >>> 0) !== entry.crc)
        throw zipError('Archive entry failed its checksum.');
      if (entry.mode & 0o111) await chmod(target, 0o755);
    }
  } finally {
    await handle.close();
  }
}
