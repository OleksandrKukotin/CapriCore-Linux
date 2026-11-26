// SPDX-License-Identifier: GPL-3.0-only
import { existsSync, lstatSync, readFileSync, statfsSync } from 'node:fs';
import path from 'node:path';

export const PRODUCT = 'capri.desktop';
export const identityFile = (root) => path.join(root, '.capri-install.json');
export function readJson(file, maximum = 65536) {
  const bytes = readFileSync(file);
  if (bytes.length > maximum) throw new Error('Installer metadata exceeds its limit');
  return JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''));
}
export function noLinks(file) {
  let cursor = path.resolve(file);
  while (true) {
    let info;
    try {
      info = lstatSync(cursor);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    if (info && (info.isSymbolicLink() || (info.isFile() && info.nlink !== 1)))
      throw new Error('Installation paths cannot contain filesystem links');
    const parent = path.dirname(cursor);
    if (cursor === parent) break;
    cursor = parent;
  }
}

export function diskFree(target) {
  let existing = path.resolve(target);
  while (!existsSync(existing) && path.dirname(existing) !== existing)
    existing = path.dirname(existing);
  const info = statfsSync(existing);
  return info.bavail * info.bsize;
}
export function assertDiskSpace(target, freeBytes, requiredBytes) {
  if (freeBytes >= requiredBytes) return;
  const gib = (bytes) => (bytes / 2 ** 30).toFixed(2) + ' GiB';
  throw Object.assign(
    new Error(
      `Not enough free space on ${path.parse(target).root}. Required: ${gib(requiredBytes)}. Available: ${gib(freeBytes)}.`,
    ),
    { code: 'CAPRI_DISK_SPACE' },
  );
}
