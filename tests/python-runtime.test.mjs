// SPDX-License-Identifier: GPL-3.0-only
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  ensureVenv,
  managedPython,
  pythonKey,
  pythonRuntime,
  setupEnvironment,
} from '../packages/installer/src/python-runtime.mjs';
import { speechSetup } from '../packages/installer/src/speech-setup.mjs';
import { fakePythonToolchain } from './fixtures/fake-python-toolchain.mjs';

const folder = () => mkdtempSync(path.join(tmpdir(), 'capri-python-runtime-'));

test('pinned interpreter keys are exact and reject unknown versions and processors', () => {
  assert.equal(pythonKey('3.11.17', 'x64'), 'cpython-3.11.17-linux-x86_64-gnu');
  assert.equal(pythonKey('3.12.12', 'arm64'), 'cpython-3.12.12-linux-aarch64-gnu');
  assert.throws(() => pythonKey('3.13.1', 'x64'), /Unsupported pinned Python/);
  assert.throws(() => pythonKey('3.11.17', 'ia32'), /processor/);
  assert.match(managedPython('/capri', '3.11.17', 'x64'), /bin\/python3\.11$/);
});

test('setup environment keeps an allowlist and drops index overrides and inherited CPU masks', () => {
  const env = setupEnvironment('/capri', {
    PATH: '/usr/bin',
    HOME: '/home/user',
    HTTPS_PROXY: 'http://proxy.invalid:3128',
    OPENSSL_ia32cap: '~0x200000200000000',
    UV_INDEX_URL: 'https://mirror.invalid/simple',
    PIP_EXTRA_INDEX_URL: 'https://mirror.invalid/extra',
    NODE_OPTIONS: '--require=/tmp/x.js',
    PYTHONPATH: '/tmp/shadow',
    GITHUB_TOKEN: 'secret',
  });
  assert.equal(env.PATH, '/usr/bin');
  assert.equal(env.HTTPS_PROXY, 'http://proxy.invalid:3128');
  for (const key of [
    'OPENSSL_ia32cap',
    'UV_INDEX_URL',
    'PIP_EXTRA_INDEX_URL',
    'NODE_OPTIONS',
    'PYTHONPATH',
    'GITHUB_TOKEN',
  ])
    assert.equal(env[key], undefined, key);
  assert.equal(env.UV_PYTHON_PREFERENCE, 'only-managed');
  assert.equal(env.UV_NO_CONFIG, '1');
  assert.equal(env.UV_CACHE_DIR, '/capri/.runtime/uv-cache');
});

test('the pinned interpreter is installed once and its reported version must match', async () => {
  const root = folder();
  const tools = fakePythonToolchain(root);
  const runtime = await pythonRuntime({ root, execute: tools.execute, findUv: tools.findUv });
  assert.equal(runtime.python, managedPython(root, '3.11.17'));
  assert.equal(tools.ran(/^python$/).length, 1);
  await pythonRuntime({ root, execute: tools.execute, findUv: tools.findUv });
  assert.equal(tools.ran(/^python$/).length, 1, 'an existing interpreter is reused');

  const wrong = folder();
  const liar = fakePythonToolchain(wrong, {
    onRun: (file, args, options) => {
      if (args[0] === '--version') options.output?.('extra');
    },
  });
  await assert.rejects(
    pythonRuntime({ root: wrong, execute: liar.execute, findUv: liar.findUv }),
    /does not match pinned Python 3\.11\.17/,
  );
});

test('a linked runtime folder is refused before anything runs', async () => {
  const root = folder();
  const elsewhere = folder();
  mkdirSync(path.join(root, '.runtime'));
  symlinkSync(elsewhere, path.join(root, '.runtime/python'));
  const tools = fakePythonToolchain(root);
  await assert.rejects(
    pythonRuntime({ root, execute: tools.execute, findUv: tools.findUv }),
    /filesystem links/,
  );
  assert.equal(tools.commands.length, 0);
});

test('a venv with the wrong Python series is moved to recovery, never deleted', async () => {
  const root = folder();
  const tools = fakePythonToolchain(root, { venvVersion: '3.10.4' });
  const runtime = await pythonRuntime({ root, execute: tools.execute, findUv: tools.findUv });
  const venv = path.join(root, '.runtime/asr-venv');
  mkdirSync(path.join(venv, 'bin'), { recursive: true });
  writeFileSync(path.join(venv, 'bin/python'), 'old');
  writeFileSync(path.join(venv, 'user-marker'), 'keep me');
  await ensureVenv({ root, name: 'asr-venv', runtime, execute: tools.execute });
  const [recovered] = readdirSync(path.join(root, '.runtime/venv-recovery'));
  assert.match(recovered, /^asr-venv-[0-9a-f]{32}$/);
  assert.equal(
    existsSync(path.join(root, '.runtime/venv-recovery', recovered, 'user-marker')),
    true,
  );
  assert.equal(tools.ran(/^venv$/).length, 1);
  await assert.rejects(
    ensureVenv({ root, name: '../escape', runtime, execute: tools.execute }),
    /Invalid owned Python environment/,
  );
});

test('a matching venv is reused without running uv', async () => {
  const root = folder();
  const tools = fakePythonToolchain(root);
  const runtime = await pythonRuntime({ root, execute: tools.execute, findUv: tools.findUv });
  await ensureVenv({ root, name: 'router-venv', runtime, execute: tools.execute });
  await ensureVenv({ root, name: 'router-venv', runtime, execute: tools.execute });
  assert.equal(tools.ran(/^venv$/).length, 1);
});

test('recognition installs through uv-retry with the pinned lock and only the needed models', async () => {
  const root = folder();
  const tools = fakePythonToolchain(root);
  const stages = [];
  const setup = speechSetup({
    root,
    execute: tools.execute,
    findUv: tools.findUv,
    stage: (s) => stages.push(s),
    baseEnv: { PATH: '/usr/bin', UV_INDEX_URL: 'https://mirror.invalid' },
  });
  await setup.recognition('fast-multi');
  const sync = tools.ran(/uv-retry\.py/)[0];
  assert.deepEqual(sync.args.slice(-5), [
    'pip',
    'sync',
    '--python',
    path.join(root, '.runtime/asr-venv/bin/python'),
    'config/asr-requirements.lock.txt',
  ]);
  assert.equal(sync.env.UV_INDEX_URL, undefined);
  assert.equal(tools.ran(/provision-multilingual-candidates/).length, 1);
  assert.equal(tools.ran(/provision-multilingual\.py/).length, 0, 'no Whisper for fast-multi');
  assert.deepEqual(stages, ['recognition-dependencies', 'recognition-models']);
  await assert.rejects(setup.recognition('everything'), /Unknown recognition/);
});

test('an unloadable ONNX Runtime is a distinct optional-router failure', async () => {
  const root = folder();
  const tools = fakePythonToolchain(root, {
    onRun: (file, args) => {
      if (args[1] === 'import onnxruntime')
        throw Object.assign(new Error('exit 1'), { exitCode: 1 });
    },
  });
  const setup = speechSetup({ root, execute: tools.execute, findUv: tools.findUv });
  await assert.rejects(setup.router(), { code: 'CAPRI_ROUTER_NATIVE_LIBRARY_UNAVAILABLE' });
  assert.equal(tools.ran(/provision-request-router/).length, 0);
});

test('voice setup verifies GPU compute, downloads models and records the runtime receipt', async () => {
  const root = folder();
  const tools = fakePythonToolchain(root);
  const setup = speechSetup({ root, execute: tools.execute, findUv: tools.findUv });
  const selected = await setup.voice();
  assert.equal(selected.profile, 'legacy');
  const sync = tools.ran(/uv-retry\.py/)[0].args;
  assert.deepEqual(sync.slice(sync.indexOf('--pytorch-profile'), sync.indexOf('--')), [
    '--pytorch-profile',
    'legacy',
  ]);
  assert(sync.includes('--torch-backend') && sync.includes('https://pypi.org/simple'));
  assert.equal(tools.ran(/^download$/).length, 1);
  assert.equal(existsSync(path.join(root, '.runtime/voice-runtime.json')), true);

  const notReady = folder();
  const cpuOnly = fakePythonToolchain(notReady, {
    doctor: { cuda: false, cudaCompute: { kernelReady: false, error: 'No CUDA device.' } },
  });
  await assert.rejects(
    speechSetup({ root: notReady, execute: cpuOnly.execute, findUv: cpuOnly.findUv }).voice(),
    /not ready\. No CUDA device\./,
  );
  assert.equal(cpuOnly.ran(/^download$/).length, 0);
});

test('AMD voice uses Python 3.12 and retries one HIP adapter at a time', async () => {
  const root = folder();
  const tools = fakePythonToolchain(root, {
    profile: 'amd',
    venvVersion: '3.12.12',
    onRun: (file, args, options) => {
      if (args.includes('doctor'))
        options.output?.(
          JSON.stringify(
            options.env.HIP_VISIBLE_DEVICES === '1'
              ? { cuda: true, cudaCompute: { kernelReady: true } }
              : { cuda: true, cudaCompute: { kernelReady: false } },
          ),
        );
    },
  });
  const original = tools.execute;
  const execute = (file, args, options) =>
    args.includes('tools/setup/select-voice-runtime.py')
      ? options.output?.(
          JSON.stringify({
            profile: 'amd',
            python: '3.12.12',
            backend: 'rocm7.2.1',
            requirements: 'x.lock',
            overrides: 'y.txt',
            amdAdapterCount: 2,
          }),
        )
      : original(file, args, options);
  const selected = await speechSetup({ root, execute, findUv: tools.findUv }).voice({
    dependenciesOnly: true,
  });
  assert.equal(selected.hipVisibleDevice, 1);
  assert.equal(existsSync(managedPython(root, '3.12.12')), true);
  const sync = tools.ran(/uv-retry\.py/)[0].args;
  assert.equal(sync.includes('--torch-backend'), false);
  assert.equal(sync.includes('--pytorch-profile'), false);
});

test('accelerated Qwen voice is switched off until Linux wheels are pinned', async () => {
  const root = folder();
  const tools = fakePythonToolchain(root);
  const setup = speechSetup({ root, execute: tools.execute, findUv: tools.findUv });
  await assert.rejects(setup.qwen({ russian: true, cuda: true }), {
    code: 'CAPRI_PLATFORM_UNAVAILABLE',
  });
  assert.equal(tools.commands.length, 0);
});
