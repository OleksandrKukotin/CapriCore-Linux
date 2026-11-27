// SPDX-License-Identifier: GPL-3.0-only
/**
 * Speech component setup on Linux: recognition, request router, voice and Qwen
 * voice. Ports `tools/setup/setup-*.ps1`; each step runs a pinned lock through
 * `tools/setup/uv-retry.py` and then the component's own provisioning script.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { platformUnavailable } from '../../runtime/src/host/platform.mjs';
import { writeJsonAtomic } from '../../runtime/src/atomic-json.mjs';
import { runCommand } from './commands.mjs';
import { capture, ensureVenv, pythonRuntime, setupEnvironment } from './python-runtime.mjs';

export const RECOGNITION_KINDS = Object.freeze(['en', 'fast-multi', 'multi']);
export const VOICE_PROFILES = Object.freeze(['auto', 'legacy', 'blackwell', 'amd']);
const LANGUAGE = /^(all|pt-BR|[a-z]{2,3})$/;
const PYPI = ['--default-index', 'https://pypi.org/simple', '--index-strategy', 'first-index'];

/** Recognition kind for a recognition language setting. */
export const recognitionKind = (language) =>
  language === 'en' ? 'en' : ['auto-europe', 'pt-BR'].includes(language) ? 'fast-multi' : 'multi';

function lastJson(lines) {
  for (let index = lines.length - 1; index >= 0; index--) {
    if (!lines[index].startsWith('{')) continue;
    try {
      return JSON.parse(lines[index]);
    } catch {
      return null;
    }
  }
  return null;
}

export function speechSetup({
  root,
  signal,
  execute = runCommand,
  findUv,
  output = () => {},
  stage = () => {},
  baseEnv = process.env,
} = {}) {
  if (!path.isAbsolute(root ?? '')) throw new Error('Speech setup needs an absolute Capri folder.');
  const env = setupEnvironment(root, baseEnv);
  const run = (executable, args, extra = {}) =>
    execute(executable, args, { cwd: root, env, signal, output, ...extra });
  const runtimes = new Map();
  const runtime = async (version) => {
    if (!runtimes.has(version))
      runtimes.set(
        version,
        await pythonRuntime({ root, version, env, signal, execute, findUv, output }),
      );
    return runtimes.get(version);
  };
  const venv = async (name, version) => {
    const rt = await runtime(version);
    return { rt, python: await ensureVenv({ root, name, runtime: rt, signal, execute, output }) };
  };
  const sync = (rt, args, transport = []) =>
    run(rt.python, ['tools/setup/uv-retry.py', '--uv', rt.uv, ...transport, '--', ...args]);

  async function asr() {
    stage('recognition-dependencies');
    const { rt, python } = await venv('asr-venv');
    await sync(rt, ['pip', 'sync', '--python', python, 'config/asr-requirements.lock.txt']);
    stage('recognition-models');
    await run(python, ['tools/setup/provision-streaming-asr.py']);
    return python;
  }

  async function recognition(kind = 'en') {
    if (!RECOGNITION_KINDS.includes(kind)) throw new Error('Unknown recognition component.');
    const python = await asr();
    if (kind === 'en') return;
    await run(python, ['tools/setup/provision-multilingual-candidates.py', '--component', 'asr']);
    if (kind === 'multi')
      await run(python, ['tools/setup/provision-multilingual.py', '--component', 'whisper']);
  }

  async function router() {
    stage('router-dependencies');
    const { rt, python } = await venv('router-venv');
    await sync(rt, ['pip', 'sync', '--python', python, 'config/router-requirements.lock.txt']);
    try {
      await run(python, ['-c', 'import onnxruntime']);
    } catch (error) {
      signal?.throwIfAborted();
      throw Object.assign(
        new Error(
          'The CPU request classifier could not load ONNX Runtime. Chat works without the optional classifier.',
        ),
        { code: 'CAPRI_ROUTER_NATIVE_LIBRARY_UNAVAILABLE', cause: error },
      );
    }
    stage('router-model');
    await run(python, ['tools/setup/provision-request-router.py']);
    await run(python, ['tools/verify/verify-request-router.py']);
  }

  /** Probe whether the voice venv can run GPU kernels; never throws for "not ready". */
  async function computeProbe(python, extraEnv) {
    let lines = [],
      code = 0;
    try {
      lines = await capture(
        execute,
        python,
        ['-m', 'integrations.voice_training', 'doctor', '--runtime-only'],
        { cwd: root, env: { ...env, ...extraEnv }, signal, output },
      );
    } catch (error) {
      signal?.throwIfAborted();
      code = error.exitCode ?? null;
    }
    const report = code === 0 ? lastJson(lines) : null;
    return {
      code,
      ready: Boolean(report?.cuda && report?.cudaCompute?.kernelReady),
      error: report?.cudaCompute?.error ?? null,
    };
  }

  async function voice({ profile = 'auto', dependenciesOnly = false, planOnly = false } = {}) {
    if (!VOICE_PROFILES.includes(profile)) throw new Error('Unknown voice runtime.');
    stage('voice-select');
    const base = await runtime();
    const selected = lastJson(
      await capture(
        execute,
        base.python,
        ['tools/setup/select-voice-runtime.py', '--profile', profile],
        { cwd: root, env, signal },
      ),
    );
    if (!selected?.profile || !selected.requirements)
      throw new Error('Could not select a compatible voice runtime.');
    const amd = selected.profile === 'amd';
    const voiceEnv = amd ? { ROCM_SDK_TARGET_FAMILY: 'custom' } : {};
    if (amd)
      output(
        'Experimental AMD ROCm voice: supported Radeon GPUs only, inference only. Hardware qualification is still in progress.',
      );
    const { rt, python } = await venv('voice-training-venv', selected.python);
    output(`Voice runtime: ${selected.profile} / PyTorch ${selected.torch} / ${selected.backend}`);
    stage('voice-dependencies');
    let args = ['pip', 'sync', '--python', python, selected.requirements];
    if (!amd) args.push('--torch-backend', selected.backend);
    if (selected.overrides)
      // pip sync takes a complete lock without overrides; the resolver's exact
      // install applies this reviewed upstream version-pin exception.
      args = [
        'pip',
        'install',
        '--exact',
        '--python',
        python,
        '--requirements',
        selected.requirements,
        '--overrides',
        selected.overrides,
        ...(amd ? [] : ['--torch-backend', selected.backend]),
      ];
    args.push(...PYPI);
    if (planOnly) args.push('--dry-run');
    await sync(rt, args, amd ? [] : ['--pytorch-profile', selected.profile]);
    if (planOnly) return selected;

    if (!dependenciesOnly || amd) {
      stage('voice-verify');
      let probe = await computeProbe(python, voiceEnv);
      const adapters = Math.min(8, Number(selected.amdAdapterCount) || 0);
      if (
        !probe.ready &&
        amd &&
        adapters > 1 &&
        baseEnv.HIP_VISIBLE_DEVICES === undefined &&
        baseEnv.CUDA_VISIBLE_DEVICES === undefined &&
        (probe.code === 0 || probe.code === null)
      ) {
        // ROCm ordinals need not match the display order. Test each adapter in a
        // clean process and keep only one that actually executes kernels.
        for (let adapter = 0; adapter < adapters; adapter++) {
          output(`Retrying AMD voice compute with only HIP adapter ${adapter}.`);
          const candidate = await computeProbe(python, {
            ...voiceEnv,
            HIP_VISIBLE_DEVICES: String(adapter),
          });
          if (candidate.ready) {
            probe = candidate;
            selected.hipVisibleDevice = adapter;
            break;
          }
        }
      }
      if (probe.code !== 0)
        throw new Error(
          `The voice runtime could not be inspected (${selected.backend}, exit ${probe.code}). Check the output above, or choose text-only replies.`,
        );
      if (!probe.ready)
        throw new Error(
          `The selected voice runtime is not ready. ${probe.error ?? ''} Check the GPU driver and choose a compatible voice.`.replace(
            /\s+/g,
            ' ',
          ),
        );
    }
    if (!dependenciesOnly) {
      stage('voice-models');
      await run(python, ['-m', 'integrations.voice_training', 'init'], {
        env: { ...env, ...voiceEnv },
      });
      // The download verifies every pinned file before writing the model receipt.
      await run(python, ['-m', 'integrations.voice_training', 'download'], {
        env: { ...env, ...voiceEnv },
      });
    }
    writeJsonAtomic(path.join(root, '.runtime/voice-runtime.json'), selected);
    return selected;
  }

  async function multilingualVoice(language = 'all') {
    if (!LANGUAGE.test(language)) throw new Error('Unsupported voice language.');
    stage('voice-models');
    const extra = {};
    try {
      const receipt = JSON.parse(
        readFileSync(path.join(root, '.runtime/voice-runtime.json'), 'utf8'),
      );
      if (receipt.profile === 'amd') {
        extra.ROCM_SDK_TARGET_FAMILY = 'custom';
        const adapter = receipt.hipVisibleDevice;
        if (
          baseEnv.HIP_VISIBLE_DEVICES === undefined &&
          baseEnv.CUDA_VISIBLE_DEVICES === undefined &&
          Number.isInteger(adapter) &&
          adapter >= 0 &&
          adapter <= 7
        )
          extra.HIP_VISIBLE_DEVICES = String(adapter);
      }
    } catch {}
    await run(
      path.join(root, '.runtime/voice-training-venv/bin/python'),
      ['tools/setup/provision-multilingual.py', '--component', 'tts', '--language', language],
      { env: { ...env, ...extra } },
    );
  }

  /** Full multilingual speech: recognition, voice dependencies and the chosen voice models. */
  async function multilingual(language = 'all') {
    await recognition('multi');
    await voice({ dependenciesOnly: true });
    await multilingualVoice(language);
  }

  async function qwen({ rocm = false, dependenciesOnly = false } = {}) {
    // integrations/voice_runtime/qwen_gpu_setup.py still pins win_amd64 wheels.
    if (rocm) throw platformUnavailable('Accelerated Qwen voice');
    stage('python');
    const { rt, python } = await venv('qwen-tts-venv');
    stage('dependencies');
    await sync(rt, [
      'pip',
      'sync',
      '--python',
      python,
      'config/requirements-qwen-tts.lock',
      '--require-hashes',
      ...PYPI,
      '--no-config',
      '--torch-backend',
      'cpu',
    ]);
    stage('verify');
    await run(python, [
      '-c',
      'from qwen_tts import Qwen3TTSModel; import torch; assert not torch.version.cuda',
    ]);
    if (dependenciesOnly) return;
    await run(python, ['-m', 'integrations.voice_runtime.qwen_provision']);
    stage('ready');
  }

  return { recognition, router, voice, multilingualVoice, multilingual, qwen, env };
}
