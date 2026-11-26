// SPDX-License-Identifier: GPL-3.0-only
import { platformUnavailable } from '../../runtime/src/host/platform.mjs';
import { LANGUAGE_PACKS } from '../../../apps/desktop/renderer/language-settings.mjs';
import { compareVersions } from '../../updater/src/releases.mjs';

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
/**
 * Installed speech recognition, voice and router components through PowerShell
 * scripts around a private uv/Python runtime. The recipe is documented in
 * docs/linux/windows-heritage.md ("Python runtime provisioning").
 */
export async function installSpeechComponents() {
  throw platformUnavailable('Speech component installation');
}
