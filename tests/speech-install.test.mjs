// SPDX-License-Identifier: GPL-3.0-only
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdirSync,
  mkdtempSync,
  writeFileSync,
  readFileSync,
  existsSync,
  copyFileSync,
} from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { root } from '../packages/runtime/src/host/paths.mjs';
import {
  installSpeechComponents,
  speechComponentSelection,
  speechPackAsset,
  SPEECH_GPU_UNSUPPORTED,
} from '../packages/installer/src/speech-components.mjs';
import { SpeechInstallService } from '../apps/desktop/speech-install-service.mjs';
import { cacheBundledVoicePack } from '../packages/installer/src/voice-pack.mjs';
import { listReleases } from '../packages/updater/src/github.mjs';
import { downloadUpdate } from '../packages/updater/src/download.mjs';
import { REPOSITORY } from '../packages/updater/src/releases.mjs';
import { fakePythonToolchain } from './fixtures/fake-python-toolchain.mjs';

function fixture() {
  const parent = path.join(root, '.runtime/speech-install-unit');
  mkdirSync(parent, { recursive: true });
  const folder = mkdtempSync(path.join(parent, 'fixture-'));
  mkdirSync(path.join(folder, 'config'), { recursive: true });
  for (const file of [
    'companion-asr.json',
    'companion-voice.json',
    'voice-upstream.json',
    'release.json',
  ])
    copyFileSync(path.join(root, 'config', file), path.join(folder, 'config', file));
  return folder;
}
function publicVoiceRepair({ credential = async () => null, releases, signal } = {}) {
  const folder = fixture();
  const model = JSON.parse(
    readFileSync(path.join(folder, 'config/voice-upstream.json'), 'utf8'),
  ).model;
  const tag = JSON.parse(readFileSync(path.join(folder, 'config/release.json'), 'utf8')).tag;
  const bytes = Buffer.from('synthetic voice archive; extraction is simulated');
  const hash = (value) => createHash('sha256').update(value).digest('hex');
  const calls = [];
  let ready = false;
  const fetchImpl = async (url, options) => {
    const authorization = new Headers(options.headers).get('authorization');
    calls.push({ url: url.href, authorization });
    assert.equal(url.origin, 'https://api.github.com');
    assert(url.pathname.startsWith(`/repos/${REPOSITORY}/releases`));
    // Simulate a token retained from a private preview which GitHub now rejects.
    if (authorization) return new Response('untrusted credential failure', { status: 401 });
    if (url.pathname.endsWith('/releases'))
      return new Response(
        JSON.stringify([
          {
            tag_name: tag,
            draft: false,
            prerelease: false,
            assets: [
              {
                id: 42,
                name: 'capri-en-v1.zip',
                state: 'uploaded',
                size: bytes.length,
                digest: 'sha256:' + hash(bytes),
              },
            ],
          },
        ]),
      );
    assert.equal(url.pathname, `/repos/${REPOSITORY}/releases/assets/42`);
    return new Response(bytes);
  };
  const tools = fakePythonToolchain(folder, {
    onRun: (_file, args) => {
      if (args.includes('download')) ready = true;
    },
  });
  const options = {
    root: folder,
    free: () => 20 * 2 ** 30,
    voiceReady: () => ready,
    hardware: async () => ({ gpus: [{ vendor: 'NVIDIA' }] }),
    gitAvailable: () => true,
    credential,
    signal,
    releases:
      releases ??
      ((options) => {
        assert.equal(options.allowAnonymousFallback, true);
        return listReleases({ ...options, fetchImpl });
      }),
    downloadPack: (asset, destination, options) =>
      downloadUpdate(asset, destination, { ...options, fetchImpl }),
    extract: async (_archive, destination, { maximumBytes }) => {
      assert.equal(maximumBytes, 256 * 1024 ** 2);
      assert(destination.includes('speech-packs'));
      mkdirSync(path.join(destination, 'references'), { recursive: true });
      writeFileSync(path.join(destination, 'adapter.json'), '{}');
      writeFileSync(path.join(destination, 'adapter.safetensors'), 'adapter fixture');
      writeFileSync(path.join(destination, 'references/neutral.wav'), 'reference fixture');
      writeFileSync(
        path.join(destination, 'voice-profile.json'),
        JSON.stringify({
          schemaVersion: 1,
          id: 'capri-en-v1',
          language: 'en',
          engine: 'chatterbox-turbo',
          baseModel: model,
          adapter: 'adapter.safetensors',
          adapterConfig: 'adapter.json',
          adapterSha256: hash('adapter fixture'),
          references: {
            neutral: { file: 'references/neutral.wav', sha256: hash('reference fixture') },
          },
        }),
      );
    },
    execute: tools.execute,
    findUv: tools.findUv,
  };
  return {
    folder,
    calls,
    repair: () => installSpeechComponents({ speech: 'en', recognition: 'off' }, options),
    ready: () => ready,
  };
}

test('missing public voice packs repair without credentials or with unreadable and malformed saved access', async (t) => {
  for (const [name, credential] of [
    ['anonymous', async () => null],
    [
      'unreadable saved access',
      async () => {
        throw new Error('Saved GitHub access could not be read');
      },
    ],
    ['malformed access', async () => 'synthetic\ncredential'],
    ['rejected optional token', async () => 'synthetic-private-preview-token'],
  ]) {
    await t.test(name, async () => {
      const f = publicVoiceRepair({ credential });
      const secret = path.join(f.folder, 'data/secrets/github-updates.json');
      mkdirSync(path.dirname(secret), { recursive: true });
      const ciphertext = JSON.stringify({
        schemaVersion: 1,
        ciphertext: 'synthetic-retained-ciphertext',
      });
      writeFileSync(secret, ciphertext);
      await f.repair();
      assert.equal(f.ready(), true);
      const anonymous = f.calls.filter((call) => !call.authorization);
      assert.equal(anonymous.length, 2);
      assert.equal(f.calls.length, name === 'rejected optional token' ? 4 : 2);
      assert.equal(readFileSync(secret, 'utf8'), ciphertext);
      const settings = JSON.parse(
        readFileSync(path.join(f.folder, 'config/companion-voice.json'), 'utf8'),
      );
      assert.equal(settings.profileDir, 'data/voices/capri/en/exports/capri-en-v1');
      assert.equal(existsSync(path.join(f.folder, '.runtime/installer/install.lock.json')), false);
    });
  }
});

test('optional speech credentials never swallow cancellation or metadata failures', async (t) => {
  await t.test('cancelled credential retrieval', async () => {
    const controller = new AbortController();
    const error = new Error('Synthetic speech cancellation');
    const f = publicVoiceRepair({
      signal: controller.signal,
      credential: async () => {
        controller.abort(error);
        throw error;
      },
    });
    await assert.rejects(f.repair(), (failure) => failure === error);
    assert.equal(f.calls.length, 0);
    assert.equal(existsSync(path.join(f.folder, '.runtime/installer/install.lock.json')), false);
  });
  await t.test('provider AbortError', async () => {
    const error = new DOMException('Synthetic credential cancellation', 'AbortError');
    const f = publicVoiceRepair({
      credential: async () => {
        throw error;
      },
    });
    await assert.rejects(f.repair(), (failure) => failure === error);
    assert.equal(f.calls.length, 0);
  });
  await t.test('metadata path policy failure', async () => {
    const error = new Error('Installation paths cannot contain filesystem links');
    const f = publicVoiceRepair({
      releases: async () => {
        throw error;
      },
    });
    await assert.rejects(f.repair(), (failure) => failure === error);
    assert.equal(f.calls.length, 0);
    assert.equal(f.ready(), false);
  });
});
test('speech installation accepts only fixed supported component IDs and reviewed release attachments', () => {
  assert.deepEqual(speechComponentSelection({ speech: 'pt', recognition: 'off' }), {
    speech: 'pt',
    recognition: 'off',
  });
  for (const value of [
    { speech: '../../bad', recognition: 'en' },
    { speech: 'off', recognition: 'off' },
    { speech: 'en', recognition: 'en', target: 'elsewhere' },
  ])
    assert.throws(() => speechComponentSelection(value));
  const asset = {
    name: 'capri-en-v1.zip',
    state: 'uploaded',
    id: 2,
    size: 100,
    digest: 'sha256:' + 'a'.repeat(64),
  };
  const release = { tag_name: 'v0.3.5', draft: false, prerelease: false, assets: [asset] };
  assert.equal(speechPackAsset([release], 'v0.3.5').id, 2);
  for (const changed of [
    { draft: true },
    { tag_name: 'v9.0.0' },
    { assets: [{ ...asset, digest: null }] },
    { assets: [{ ...asset, name: 'other.zip' }] },
  ])
    assert.throws(() => speechPackAsset([{ ...release, ...changed }], 'v0.3.5'));
});
test('component repair releases its lock on invalid configuration and never installs voice on an unsupported GPU', async () => {
  const folder = fixture();
  const options = {
    root: folder,
    node: process.execPath,
    hardware: async () => ({ gpus: [] }),
    voiceReady: () => false,
    recognitionReady: () => true,
  };
  for (let attempt = 0; attempt < 2; attempt++) {
    await assert.rejects(
      installSpeechComponents({ speech: 'ru', recognition: 'off' }, options),
      /NVIDIA/,
    );
    assert.equal(existsSync(path.join(folder, '.runtime/installer/install.lock.json')), false);
  }
  writeFileSync(path.join(folder, 'config/companion-asr.json'), 'broken');
  await assert.rejects(installSpeechComponents({ speech: 'ru', recognition: 'off' }, options));
  assert.equal(existsSync(path.join(folder, '.runtime/installer/install.lock.json')), false);
});
test('recognition-only installation downloads the necessary recognizer without voice dependencies', async (t) => {
  for (const [language, script] of [
    ['en', /provision-streaming-asr/],
    ['pt-BR', /provision-multilingual-candidates/],
  ])
    await t.test(language, async () => {
      const folder = fixture();
      let ready = false;
      const tools = fakePythonToolchain(folder, {
        onRun: (_file, args) => {
          if (args.some((v) => script.test(v))) ready = true;
        },
      });
      await installSpeechComponents(
        { speech: 'off', recognition: language },
        {
          root: folder,
          free: () => 4 * 2 ** 30,
          hardware: () => {
            throw new Error('GPU probe must not run');
          },
          recognitionReady: () => ready,
          execute: tools.execute,
          findUv: tools.findUv,
        },
      );
      assert.equal(ready, true);
      assert.equal(tools.ran(/voice-training|select-voice-runtime|^whisper$/).length, 0);
    });
});
test('speech preflight reports required and available space before downloading', async () => {
  await assert.rejects(
    installSpeechComponents(
      { speech: 'en', recognition: 'off' },
      {
        root: fixture(),
        node: process.execPath,
        hardware: async () => ({ gpus: [{ vendor: 'NVIDIA' }] }),
        voiceReady: () => false,
        gitAvailable: () => true,
        free: () => 2 * 2 ** 30,
        execute: () => assert.fail('must check disk space before running anything'),
      },
    ),
    { code: 'CAPRI_DISK_SPACE', message: /Required: .* GiB\. Available: 2\.00 GiB/ },
  );
});
test('non-English installation prepares the voice environment and the selected multilingual model without downloading English weights', async () => {
  const folder = fixture(),
    calls = [];
  const model = JSON.parse(
    readFileSync(path.join(folder, 'config/voice-upstream.json'), 'utf8'),
  ).model;
  // A minimal checksum-valid profile fixture, never model weights or user recordings.
  const { createHash } = await import('node:crypto');
  const hash = (value) => createHash('sha256').update(value).digest('hex');
  const pack = path.join(folder, 'data/voices/capri/en/exports/capri-en-v1');
  mkdirSync(path.join(pack, 'references'), { recursive: true });
  writeFileSync(path.join(pack, 'adapter.json'), '{}');
  writeFileSync(path.join(pack, 'adapter.safetensors'), 'fixture');
  writeFileSync(path.join(pack, 'references/neutral.wav'), 'reference');
  writeFileSync(
    path.join(pack, 'voice-profile.json'),
    JSON.stringify({
      schemaVersion: 1,
      id: 'capri-en-v1',
      language: 'en',
      engine: 'chatterbox-turbo',
      baseModel: model,
      adapter: 'adapter.safetensors',
      adapterConfig: 'adapter.json',
      adapterSha256: hash('fixture'),
      references: { neutral: { file: 'references/neutral.wav', sha256: hash('reference') } },
    }),
  );
  const seeded = fixture();
  const seed = cacheBundledVoicePack(pack, seeded, model);
  assert.equal(existsSync(path.join(seed, 'voice-profile.json')), true);
  assert.equal(
    existsSync(path.join(seeded, 'data/voices/capri/en/exports')),
    false,
    'The included seed must not overwrite editable voice exports',
  );
  let ready = false;
  const tools = fakePythonToolchain(folder, {
    onRun: (_file, args) => {
      if (args.includes('tts')) ready = true;
    },
  });
  await installSpeechComponents(
    { speech: 'pt', recognition: 'off' },
    {
      root: folder,
      free: () => 14 * 2 ** 30,
      voiceReady: () => ready,
      hardware: async () => ({ gpus: [{ vendor: 'NVIDIA' }] }),
      gitAvailable: () => true,
      releases: () => {
        throw new Error('An installed profile must not require GitHub');
      },
      execute: tools.execute,
      findUv: tools.findUv,
    },
  );
  assert.equal(tools.ran(/uv-retry/).length, 1, 'voice dependencies are installed');
  assert.equal(tools.ran(/^doctor$|^download$/).length, 0, 'dependencies only, no English weights');
  const [multilingual] = tools.ran(/provision-multilingual\.py/);
  assert.deepEqual(multilingual.args.slice(-4), ['--component', 'tts', '--language', 'pt']);
  assert.equal(tools.ran(/provision-streaming-asr|capri\.mjs/).length, 0);
});
test('voice installation stops with an actionable error when git is missing', async () => {
  await assert.rejects(
    installSpeechComponents(
      { speech: 'en', recognition: 'off' },
      {
        root: fixture(),
        voiceReady: () => false,
        hardware: async () => ({ gpus: [{ vendor: 'NVIDIA' }] }),
        gitAvailable: () => false,
        free: () => assert.fail('git is checked before storage'),
        execute: () => assert.fail('nothing runs without git'),
      },
    ),
    { code: 'CAPRI_GIT_REQUIRED' },
  );
});
test('speech progress reconnects, cancellation stops the owned task, and retry completes without changing user settings', async () => {
  const folder = fixture(),
    events = [];
  let calls = 0,
    prepared = 0;
  const service = new SpeechInstallService({
    root: folder,
    node: process.execPath,
    emit: (event) => events.push(event),
    before: async (_signal, selection) => {
      assert.equal(selection.recognition, 'off');
    },
    ready: async () => {
      prepared++;
    },
    install: async (selection, { signal, emit }) => {
      calls++;
      emit({ stage: 'voice-models', progress: { received: 10, total: 20 } });
      if (calls === 1)
        await new Promise((resolve, reject) =>
          signal.addEventListener('abort', () => reject(signal.reason), { once: true }),
        );
    },
  });
  service.start({ speech: 'ru', recognition: 'off' });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(service.snapshot().phase, 'installing');
  assert.equal(service.busy('speech'), true);
  assert.equal(service.busy('recognition'), false);
  assert.equal(service.snapshot().progress.received, 10);
  assert.throws(() => service.start({ speech: 'en', recognition: 'off' }), /already running/);
  await service.close();
  assert.equal(service.snapshot().phase, 'cancelled');
  assert.equal(prepared, 0);
  service.start({ speech: 'ru', recognition: 'off' });
  await service.task;
  assert.equal(service.snapshot().phase, 'ready');
  assert.equal(prepared, 1);
  assert.equal(existsSync(path.join(folder, 'data/desktop/languages.json')), false);
  const status = path.join(folder, '.runtime/installer/speech-status.json');
  writeFileSync(
    status,
    JSON.stringify({ phase: 'installing', selection: { speech: 'ru', recognition: 'off' } }),
  );
  assert.equal(
    new SpeechInstallService({ root: folder, node: process.execPath }).snapshot().phase,
    'interrupted',
  );
});

test('recognition repair still holds the microphone until the installer settles', async () => {
  const service = new SpeechInstallService({
    root: fixture(),
    node: process.execPath,
    install: async () => {},
  });
  service.start({ speech: 'off', recognition: 'vi' });
  assert.equal(service.busy('recognition'), true);
  assert.equal(service.busy('speech'), false);
  await service.task;
  assert.equal(service.busy('recognition'), false);
});

test('voice download status shows the safe current filename and its aggregate percentage', async () => {
  const events = [];
  const service = new SpeechInstallService({
    root: fixture(),
    node: process.execPath,
    emit: (event) => events.push(event),
    install: async (_selection, { emit }) => {
      for (const message of [
        'Voice model file 1/10: t3_turbo_v1.safetensors',
        'Connecting: t3_turbo_v1.safetensors (1915.5 MB)',
        'Download interrupted: t3_turbo_v1.safetensors (network timeout; host=example.invalid; stage=connect). Retrying 2/5 in 1 s; 0.0 MB retained.',
        '25% overall | t3_turbo_v1.safetensors: 40% | 765.2/1915.5 MB',
        'Voice model file 2/10: https://example.invalid/private?credential=test-only',
        'Voice model file 2/10: synthetic_private_value',
        '100% overall | Voice model download verified.',
      ])
        emit({ stage: 'voice-runtime', message });
    },
  });
  service.start({ speech: 'en', recognition: 'off' });
  await service.task;
  assert.deepEqual(events.find(({ progress }) => progress?.received === 25)?.progress, {
    received: 25,
    total: 100,
  });
  assert.equal(
    events.find(({ progress }) => progress?.received === 25)?.currentFile,
    't3_turbo_v1.safetensors',
  );
  assert.deepEqual(
    events.filter(({ transferState }) => transferState).map(({ transferState }) => transferState),
    ['connecting', 'retrying'],
  );
  assert.equal(events.find(({ progress }) => progress?.received === 25)?.transferState, null);
  assert.equal(events.find(({ progress }) => progress?.received === 100)?.currentFile, null);
  assert.doesNotMatch(JSON.stringify(events), /example\.invalid|test-only|synthetic_private_value/);
});

test('an unsupported GPU is shown as a specific voice installation error', async () => {
  const service = new SpeechInstallService({
    root: fixture(),
    node: process.execPath,
    install: (selection, options) =>
      installSpeechComponents(selection, {
        ...options,
        voiceReady: () => false,
        hardware: async () => ({ gpus: [] }),
      }),
  });
  service.start({ speech: 'en', recognition: 'off' });
  await service.task;
  assert.equal(service.snapshot().phase, 'error');
  assert.equal(service.snapshot().error, SPEECH_GPU_UNSUPPORTED);
  assert.equal(service.snapshot().errorCode, 'CAPRI_VOICE_GPU_UNSUPPORTED');
});

test('French voice on an unsupported Radeon stops before disk or network work with an actionable error', async () => {
  const service = new SpeechInstallService({
    root: fixture(),
    node: process.execPath,
    install: (selection, options) =>
      installSpeechComponents(selection, {
        ...options,
        voiceReady: () => false,
        hardware: async () => ({
          gpus: [{ vendor: 'amd', name: 'AMD Radeon RX 6700 XT' }],
        }),
        free: () => assert.fail('Unsupported GPU is checked before storage.'),
        execute: () => assert.fail('Unsupported GPU must not run any voice runtime.'),
      }),
  });
  service.start({ speech: 'fr', recognition: 'off' });
  await service.task;
  assert.equal(service.snapshot().phase, 'error');
  assert.equal(service.snapshot().failedStage, 'checking');
  assert.equal(service.snapshot().selection.speech, 'fr');
  assert.equal(service.snapshot().errorCode, 'CAPRI_VOICE_GPU_UNSUPPORTED');
  assert.equal(service.snapshot().error, SPEECH_GPU_UNSUPPORTED);
  assert.equal(service.snapshot().progress, null);
});
