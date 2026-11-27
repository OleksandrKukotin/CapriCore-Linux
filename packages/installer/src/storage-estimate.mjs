// SPDX-License-Identifier: GPL-3.0-only
import storage from '../../../config/speech-storage.json' with { type: 'json' };
import asr from '../../../config/asr-model-upstream.json' with { type: 'json' };
import vad from '../../../config/asr-vad-upstream.json' with { type: 'json' };
import classifier from '../../../config/request-router-upstream.json' with { type: 'json' };
import candidates from '../../../config/multilingual-candidates.json' with { type: 'json' };
import speech from '../../../config/multilingual-runtime.json' with { type: 'json' };
import qwenVoice from '../../../config/qwen-tts-upstream.json' with { type: 'json' };

const MiB = 2 ** 20;
const modelBytes = ({ files }) =>
  Object.values(files).reduce((bytes, file) => bytes + file.bytes, 0);

/**
 * Budget for missing speech components, including their shared Python runtime.
 * uv itself comes from the system package manager on Linux and is not counted.
 */
export function estimateSpeechStorage(
  { recognition = 'off', speechLanguage = 'off', router = false, voiceMode },
  { rocmVoice = false } = {},
) {
  const qwen = voiceMode === 'qwen';
  const voice = speechLanguage !== 'off' && !qwen;
  let downloadBytes = 0;
  let extraBytes = storage.reserveMiB * MiB;
  const addPackages = ({ downloadMiB, expandedMiB }) => {
    downloadBytes += downloadMiB * MiB;
    extraBytes += expandedMiB * MiB;
  };
  if (recognition !== 'off' || router || voice || qwen) addPackages(storage.python);
  if (recognition !== 'off') {
    addPackages(storage.recognition);
    downloadBytes += modelBytes(asr) + modelBytes(vad);
    if (recognition !== 'en') downloadBytes += modelBytes(candidates.asr);
    if (!['en', 'auto-europe', 'pt-BR'].includes(recognition))
      downloadBytes += modelBytes(speech.whisper);
  }
  if (router) {
    addPackages(storage.router);
    downloadBytes += modelBytes(classifier);
  }
  if (qwen) {
    addPackages(storage.qwenVoice);
    downloadBytes += modelBytes(qwenVoice);
  } else if (voice) {
    addPackages(rocmVoice ? storage.rocmVoice : storage.cudaVoice);
    const multilingual = speechLanguage === 'pt-BR' ? speech['tts-pt-br'] : speech.tts;
    downloadBytes += speechLanguage === 'en' ? storage.englishVoiceBytes : modelBytes(multilingual);
    if (rocmVoice) addPackages(storage.python); // The AMD runtime additionally needs Python 3.12.
    if (speechLanguage === 'zh') {
      downloadBytes += speech.chinese.archiveBytes;
      extraBytes += modelBytes(speech.chinese);
    }
  }
  return { downloadBytes, requiredBytes: downloadBytes + extraBytes };
}
