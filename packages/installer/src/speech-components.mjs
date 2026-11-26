// SPDX-License-Identifier: GPL-3.0-only
import { mkdirSync, mkdtempSync } from 'node:fs';
import path from 'node:path';
import { LANGUAGE_PACKS } from '../../../apps/desktop/renderer/language-settings.mjs';
import {
  speechModelsInstalled,
  recognitionModelsInstalled,
} from '../../../apps/desktop/language-models.mjs';
import { voiceGpuSupported } from '../../runtime/src/hardware/voice-gpu.mjs';
import { probeHardware } from '../../runtime/src/hardware/probe.mjs';
import { findExecutable } from '../../runtime/src/host/paths.mjs';
import { writeJsonAtomic } from '../../runtime/src/atomic-json.mjs';
import { listReleases, githubCredential } from '../../updater/src/github.mjs';
import { downloadUpdate } from '../../updater/src/download.mjs';
import { compareVersions } from '../../updater/src/releases.mjs';
import { noLinks, readJson, diskFree, assertDiskSpace } from './policy.mjs';
import { estimateSpeechStorage } from './storage-estimate.mjs';
import { runCommand } from './commands.mjs';
import { installationLock } from './lock.mjs';
import { validateVoicePack, importVoicePack } from './voice-pack.mjs';
import { extractZip } from './zip.mjs';
import { recognitionKind, speechSetup } from './speech-setup.mjs';

export const SPEECH_GPU_UNSUPPORTED =
  'Voice needs NVIDIA CUDA or a supported AMD ROCm GPU (experimental). This PC can still use text replies and microphone recognition. Integrated graphics and Intel voice acceleration are not supported.';

export function speechComponentSelection(value) {
  if (
    !value ||
    Object.keys(value).some((key) => !['speech', 'recognition'].includes(key)) ||
    !['off', ...LANGUAGE_PACKS.filter((p) => p.speechReady).map((p) => p.id)].includes(
      value.speech,
    ) ||
    !['off', 'auto', 'auto-europe', ...LANGUAGE_PACKS.map((p) => p.id)].includes(
      value.recognition,
    ) ||
    (value.speech === 'off' && value.recognition === 'off')
  )
    throw new Error('Choose a supported voice or recognition language.');
  return { speech: value.speech, recognition: value.recognition };
}

/** Only the named voice attachment from an actual stable Capri release is accepted. */
export function speechPackAsset(releases, tag) {
  const choices = releases
    .filter((r) => {
      try {
        return !r.draft && !r.prerelease && compareVersions(r.tag_name, tag) <= 0;
      } catch {
        return false;
      }
    })
    .sort((a, b) => compareVersions(b.tag_name, a.tag_name));
  for (const release of choices) {
    const asset = release.assets?.find(
      (a) => a.name === 'capri-en-v1.zip' && a.state === 'uploaded',
    );
    if (
      asset &&
      Number.isSafeInteger(asset.id) &&
      asset.id > 0 &&
      Number.isSafeInteger(asset.size) &&
      asset.size > 0 &&
      asset.size <= 200 * 1024 ** 2 &&
      /^sha256:[a-f0-9]{64}$/.test(asset.digest ?? '')
    )
      return { id: asset.id, bytes: asset.size, sha256: asset.digest.slice(7), name: asset.name };
  }
  throw new Error(
    'The included Capri voice pack is unavailable. Use Capri Setup with its included voice pack.',
  );
}

/** Component-only repair: no source replacement, npm install, model pull or user-language mutation. */
export async function installSpeechComponents(
  selection,
  {
    root,
    signal,
    emit = () => {},
    execute = runCommand,
    findUv,
    hardware = probeHardware,
    free = diskFree,
    credential = githubCredential,
    releases = listReleases,
    downloadPack = downloadUpdate,
    extract = extractZip,
    voiceReady = speechModelsInstalled,
    recognitionReady = recognitionModelsInstalled,
    gitAvailable = () => Boolean(findExecutable('git')),
  } = {},
) {
  selection = speechComponentSelection(selection);
  if (!path.isAbsolute(root ?? ''))
    throw new Error('Speech installation requires an absolute Capri folder.');
  signal?.throwIfAborted();
  const cache = path.join(root, '.runtime/installer');
  noLinks(cache);
  mkdirSync(cache, { recursive: true });
  const unlock = installationLock(cache);
  let stage = 'checking';
  const report = (patch) => emit({ stage, ...patch });
  try {
    const config = readJson(path.join(root, 'config/companion-asr.json'));
    const needVoice = selection.speech !== 'off' && !voiceReady(root, selection.speech);
    const needAsr =
      selection.recognition !== 'off' && !recognitionReady(root, selection.recognition, config);
    if (!needVoice && !needAsr) return;
    let rocmVoice = false;
    if (needVoice) {
      const detected = await hardware();
      signal?.throwIfAborted();
      if (!voiceGpuSupported(detected))
        throw Object.assign(new Error(SPEECH_GPU_UNSUPPORTED), {
          code: 'CAPRI_VOICE_GPU_UNSUPPORTED',
        });
      rocmVoice = !detected.gpus?.some((gpu) => /nvidia/i.test(gpu.vendor ?? gpu.name ?? ''));
      // The voice lock installs packages from git revisions.
      if (!gitAvailable())
        throw Object.assign(
          new Error(
            'Voice installation needs git. Install it with your package manager and retry.',
          ),
          {
            code: 'CAPRI_GIT_REQUIRED',
          },
        );
    }
    const { requiredBytes } = estimateSpeechStorage(
      {
        speechLanguage: needVoice ? selection.speech : 'off',
        recognition: needAsr ? selection.recognition : 'off',
      },
      { rocmVoice },
    );
    assertDiskSpace(root, free(root), requiredBytes);
    const setup = speechSetup({
      root,
      signal,
      execute,
      findUv,
      output: (message) => report({ message }),
    });
    const step = async (name, task) => {
      signal?.throwIfAborted();
      stage = name;
      report({ progress: null, message: null });
      await task();
      signal?.throwIfAborted();
    };
    if (needAsr)
      await step('recognition', () => setup.recognition(recognitionKind(selection.recognition)));
    if (needVoice) {
      await step('voice-pack', async () => {
        const settings = readJson(path.join(root, 'config/companion-voice.json'));
        const expected = readJson(path.join(root, 'config/voice-upstream.json')).model;
        let folder = path.resolve(root, settings.profileDir);
        if (!folder.startsWith(root + path.sep))
          throw new Error('The voice profile must stay inside Capri.');
        try {
          validateVoicePack(folder, expected);
          return;
        } catch {}
        folder = [
          path.join(root, 'data/voices/capri/en/exports/capri-en-v1'),
          path.join(root, 'data/speech/bundled-voice'),
          path.join(root, '.runtime/installer/bundled-voice'),
          path.join(root, '.bundled-voice'),
        ].find((candidate) => {
          try {
            validateVoicePack(candidate, expected);
            return true;
          } catch {
            return false;
          }
        });
        if (!folder) {
          let token = null;
          try {
            const candidate = await credential(root);
            if (typeof candidate === 'string' && candidate && !/[\x00-\x20\x7f]/.test(candidate))
              token = candidate;
          } catch (error) {
            signal?.throwIfAborted();
            if (error?.name === 'AbortError') throw error;
            // Public voice packs do not depend on decrypting optional saved GitHub access.
          }
          signal?.throwIfAborted();
          const available = await releases({ token, signal, allowAnonymousFallback: true });
          const asset = speechPackAsset(
            available,
            readJson(path.join(root, 'config/release.json')).tag,
          );
          const archive = await downloadPack(asset, path.join(cache, 'downloads'), {
            token,
            signal,
            progress: (progress) => report({ progress }),
          });
          const parent = path.join(cache, 'speech-packs');
          noLinks(parent);
          mkdirSync(parent, { recursive: true });
          folder = mkdtempSync(path.join(parent, 'pack-'));
          await extract(archive, folder, { maximumBytes: 256 * 1024 ** 2, signal });
        }
        settings.profileDir = importVoicePack(folder, root, expected);
        writeJsonAtomic(path.join(root, 'config/companion-voice.json'), settings);
      });
      await step('voice-runtime', () =>
        setup.voice({ dependenciesOnly: selection.speech !== 'en' }),
      );
      if (selection.speech !== 'en')
        await step('voice-models', () => setup.multilingualVoice(selection.speech));
    }
    await step('verify', async () => {
      if (selection.speech !== 'off' && !voiceReady(root, selection.speech))
        throw new Error(
          'Voice files are still incomplete. Retry installation or save a diagnostic report.',
        );
      if (selection.recognition !== 'off' && !recognitionReady(root, selection.recognition, config))
        throw new Error(
          'Recognition files are still incomplete. Retry installation or save a diagnostic report.',
        );
    });
  } finally {
    unlock();
  }
}
