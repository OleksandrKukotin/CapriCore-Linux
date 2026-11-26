// SPDX-License-Identifier: GPL-3.0-only
import { realpathSync, statSync } from 'node:fs';
import path from 'node:path';
import { findExecutable } from '../../runtime/src/host/paths.mjs';

/**
 * Locate uv for the private Python environments. Windows builds downloaded a
 * pinned uv; on Linux it comes from the package manager (`pacman -S uv`) or
 * Astral's installer (~/.local/bin/uv). An explicit CAPRI_UV_PATH wins.
 */
export async function ensureUv({ root, env = process.env, signal } = {}) {
  if (!path.isAbsolute(root ?? '')) throw Error('Runtime preparation needs an absolute Capri folder.');
  signal?.throwIfAborted();
  const explicit = env.CAPRI_UV_PATH;
  const candidates = [
    explicit,
    findExecutable('uv', {
      env,
      extra: [path.join(root, '.runtime/uv/uv'), env.HOME && path.join(env.HOME, '.local/bin/uv')],
    }),
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      const file = realpathSync(candidate);
      const info = statSync(file);
      if (info.isFile() && (info.mode & 0o111) !== 0) return file;
    } catch {
      if (candidate === explicit) throw new Error('CAPRI_UV_PATH must point to the uv executable.');
    }
  }
  throw new Error('uv is required for speech components. Install it with your package manager.');
}
