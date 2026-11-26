// SPDX-License-Identifier: GPL-3.0-only
// Release bookkeeping used by the update check. Applying an update was done by a
// Windows update host; a Linux source checkout updates with `git pull`.
import { readFileSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { readJson, noLinks, identityFile } from '../../installer/src/policy.mjs';
import { parseVersion, LEGACY_PREVIEW_TAG, LEGACY_PREVIEW_VERSION } from './releases.mjs';

const hash = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');

/** E1's released installer and source archive both used an unsuffixed tag. */
export function installedUpdateVersion(root, tag) {
  if (tag !== LEGACY_PREVIEW_TAG) return tag;
  const main = path.join(root, 'apps/desktop/main.mjs');
  try {
    noLinks(main);
    const info = statSync(main);
    if (
      info.isFile() &&
      info.size === 303663 &&
      hash(main) === '2080df1ceecbe4e3a09a3f0007f4c9c6393760e647a9b9a1bd093dc2b4122083'
    )
      return LEGACY_PREVIEW_VERSION;
  } catch {
    // An unverified installation keeps its recorded version.
  }
  return tag;
}

export function managedInstallation(root) {
  if (!path.isAbsolute(root)) throw new Error('An absolute installation folder is required');
  root = path.resolve(root);
  noLinks(root);
  if (existsSync(path.join(root, '.git')))
    throw new Error('Development checkout: update it with git pull.');
  const identity = readJson(identityFile(root));
  if (
    identity.schemaVersion !== 1 ||
    identity.productId !== 'capri.desktop' ||
    typeof identity.root !== 'string' ||
    path.resolve(identity.root) !== root ||
    !/^[a-f0-9-]{36}$/.test(identity.installId ?? '')
  )
    throw new Error('Invalid managed installation');
  parseVersion(identity.version);
  return identity;
}
