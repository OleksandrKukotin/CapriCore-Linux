// SPDX-License-Identifier: GPL-3.0-only
import path from 'node:path';

/** Interpreter of a private venv under `.runtime/` (uv creates POSIX layouts on Linux). */
export const venvPython = (root, name) => path.join(root, '.runtime', name, 'bin/python');

/**
 * Variables a Python worker may inherit. Everything else (credentials, proxies,
 * user Python settings) stays out of its clean environment.
 */
export const PYTHON_ENV_KEYS = Object.freeze([
  'PATH',
  'HOME',
  'TMPDIR',
  'LANG',
  'LC_ALL',
  'LD_LIBRARY_PATH',
  'XDG_RUNTIME_DIR',
  'XDG_CACHE_HOME',
]);

export function inheritedEnvironment(keys = PYTHON_ENV_KEYS, source = process.env) {
  const env = {};
  for (const key of keys) if (source[key]) env[key] = source[key];
  return env;
}
