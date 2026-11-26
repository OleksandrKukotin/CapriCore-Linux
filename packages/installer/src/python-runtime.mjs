// SPDX-License-Identifier: GPL-3.0-only
/**
 * Private Python for speech components: a pinned, uv-managed CPython under
 * `.runtime/python` and one venv per component. Port of the Windows
 * `python-runtime.ps1`; see docs/linux/windows-heritage.md.
 */
import { randomUUID } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, renameSync } from 'node:fs';
import path from 'node:path';
import { noLinks } from './policy.mjs';
import { runCommand } from './commands.mjs';
import { ensureUv } from './uv-runtime.mjs';

export const PYTHON_VERSIONS = Object.freeze(['3.11.17', '3.12.12']);
export const DEFAULT_PYTHON = '3.11.17';
export const OWNED_VENVS = Object.freeze([
  'asr-venv',
  'router-venv',
  'voice-training-venv',
  'qwen-tts-venv',
  'qwen-tts-cuda-venv',
  'qwen-tts-rocm-venv',
  'npu-openvino',
]);

/** User settings that could make uv or pip install from somewhere other than the pinned sources. */
export const INDEX_OVERRIDES = Object.freeze([
  'UV_INDEX',
  'UV_EXTRA_INDEX_URL',
  'UV_INDEX_URL',
  'UV_DEFAULT_INDEX',
  'UV_FIND_LINKS',
  'UV_NO_INDEX',
  'UV_INDEX_STRATEGY',
  'UV_TORCH_BACKEND',
  'UV_OVERRIDE',
  'UV_CONSTRAINT',
  'UV_BUILD_CONSTRAINT',
  'PIP_INDEX_URL',
  'PIP_EXTRA_INDEX_URL',
  'PIP_FIND_LINKS',
  'PIP_CONSTRAINT',
]);

const INHERITED = Object.freeze([
  'PATH',
  'HOME',
  'LANG',
  'LC_ALL',
  'XDG_CACHE_HOME',
  'XDG_RUNTIME_DIR',
  // Proxies and CA bundles are how many networks reach PyPI at all.
  'HTTP_PROXY',
  'HTTPS_PROXY',
  'NO_PROXY',
  'http_proxy',
  'https_proxy',
  'no_proxy',
  'SSL_CERT_FILE',
  'SSL_CERT_DIR',
  'CUDA_VISIBLE_DEVICES',
  'HIP_VISIBLE_DEVICES',
  'CAPRI_UV_PATH',
]);

/**
 * Clean environment for uv and the component Pythons. Only an allowlist is
 * inherited, so NODE_OPTIONS, PYTHONPATH, index overrides and OPENSSL_ia32cap
 * (uv's AWS-LC aborts on an inherited CPU mask) never reach the children.
 */
export function setupEnvironment(root, source = process.env) {
  const env = {};
  for (const key of INHERITED) if (source[key]) env[key] = source[key];
  const runtime = path.join(root, '.runtime');
  Object.assign(env, {
    UV_PYTHON_INSTALL_DIR: path.join(runtime, 'python'),
    UV_PYTHON_BIN_DIR: path.join(runtime, 'python-bin'),
    UV_PYTHON_INSTALL_BIN: '0',
    UV_PYTHON_PREFERENCE: 'only-managed',
    UV_PYTHON_DOWNLOADS: 'manual',
    UV_NO_CONFIG: '1',
    UV_CACHE_DIR: path.join(runtime, 'uv-cache'),
    PYTHONUTF8: '1',
    PYTHONIOENCODING: 'utf-8',
    PYTHONNOUSERSITE: '1',
    HF_HUB_DISABLE_TELEMETRY: '1',
    TMPDIR: path.join(runtime, 'tmp'),
  });
  for (const key of INDEX_OVERRIDES) delete env[key];
  return env;
}

const UV_ARCH = { x64: 'x86_64', arm64: 'aarch64' };

/** uv's exact install key. The folder name is fixed, so it is never decoded from `uv python find`. */
export function pythonKey(version, arch = process.arch) {
  if (!PYTHON_VERSIONS.includes(version)) throw new Error(`Unsupported pinned Python ${version}.`);
  const machine = UV_ARCH[arch];
  if (!machine) throw new Error(`Speech components do not support the ${arch} processor.`);
  return `cpython-${version}-linux-${machine}-gnu`;
}

export const pythonSeries = (version) => version.split('.').slice(0, 2).join('.');

/** The versioned interpreter is the real file; `bin/python3` is a symlink to it. */
export function managedPython(root, version, arch = process.arch) {
  return path.join(
    root,
    '.runtime/python',
    pythonKey(version, arch),
    'bin',
    `python${pythonSeries(version)}`,
  );
}

/** Run a command and return its output lines (each capped by runCommand). */
export async function capture(execute, executable, args, options = {}) {
  const lines = [];
  await execute(executable, args, {
    ...options,
    output: (line) => {
      lines.push(line);
      options.output?.(line);
    },
  });
  return lines;
}

function ownedDirectory(root, relative) {
  const base = path.join(root, '.runtime');
  const target = path.resolve(base, relative);
  if (!target.startsWith(base + path.sep)) throw new Error('Invalid owned Python path.');
  noLinks(target);
  return target;
}

/** Ensure the pinned interpreter exists and really is that version. */
export async function pythonRuntime({
  root,
  version = DEFAULT_PYTHON,
  env = setupEnvironment(root),
  signal,
  execute = runCommand,
  findUv = ensureUv,
  output,
} = {}) {
  if (!path.isAbsolute(root ?? '')) throw new Error('Python setup needs an absolute Capri folder.');
  const key = pythonKey(version);
  const uv = await findUv({ root, env, signal });
  for (const directory of ['python', 'python-bin', 'uv-cache', 'tmp'])
    mkdirSync(ownedDirectory(root, directory), { recursive: true });
  const python = managedPython(root, version);
  noLinks(python);
  const options = { cwd: root, env, signal, output };
  if (!existsSync(python))
    await execute(uv, ['python', 'install', key, '--no-bin', '--no-config'], options);
  noLinks(python);
  let reported;
  try {
    reported = await capture(execute, python, ['--version'], { ...options, output: undefined });
  } catch {
    throw new Error(`Pinned Python ${version} could not start.`);
  }
  if (reported.join('\n').trim() !== `Python ${version}`)
    throw new Error(`The local Python runtime does not match pinned Python ${version}.`);
  return { uv, python, version, env };
}

/**
 * Reuse a component venv when its Python series matches; otherwise move it to
 * `.runtime/venv-recovery/` (never delete) and create a fresh one.
 */
export async function ensureVenv({ root, name, runtime, signal, execute = runCommand, output }) {
  if (!OWNED_VENVS.includes(name)) throw new Error('Invalid owned Python environment.');
  const venv = ownedDirectory(root, name);
  const python = path.join(venv, 'bin/python');
  const series = pythonSeries(runtime.version);
  const options = { cwd: root, env: runtime.env, signal };
  if (existsSync(python)) {
    try {
      const reported = await capture(execute, python, ['--version'], options);
      if (
        new RegExp(`^Python ${series.replace('.', '\\.')}\\.\\d+$`).test(reported.join('').trim())
      )
        return python;
    } catch {
      signal?.throwIfAborted();
    }
  }
  let existing;
  try {
    existing = lstatSync(venv);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (existing) {
    if (!existing.isDirectory())
      throw new Error('The owned Python environment path is not a directory.');
    const recovery = ownedDirectory(
      root,
      `venv-recovery/${name}-${randomUUID().replaceAll('-', '')}`,
    );
    mkdirSync(path.dirname(recovery), { recursive: true });
    // Same-filesystem rename keeps the interrupted environment for inspection.
    renameSync(venv, recovery);
    output?.(`Repairing ${name}. Previous environment retained at ${recovery}`);
  }
  await execute(runtime.uv, ['venv', venv, '--python', runtime.python, '--no-config'], {
    ...options,
    output,
  });
  if (!existsSync(python))
    throw new Error(`Could not create the owned Python environment: ${name}`);
  return python;
}
