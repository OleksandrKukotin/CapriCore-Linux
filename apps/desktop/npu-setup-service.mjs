// SPDX-License-Identifier: GPL-3.0-only
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { platformUnavailable } from '../../packages/runtime/src/host/platform.mjs';
import packs from '../../config/npu-models.json' with { type: 'json' };
import {
  downloadArtifact,
  noLinks,
  operationLock,
  safeFileName,
} from '../../packages/runtime/src/huggingface/artifacts.mjs';
import { NpuInference, npuPython } from '../../packages/runtime/src/providers/npu-inference.mjs';
import { readNpuSettings } from '../../packages/runtime/src/providers/npu-settings.mjs';

const amdRuntimeRequired = 'Install AMD Ryzen AI Software for Linux, then refresh devices.';
const driverRequired = 'Load the NPU kernel driver (intel_vpu or amdxdna), then refresh devices.';
const labels = { openvino: 'Intel NPU', vitis: 'AMD Ryzen AI NPU', qnn: 'Qualcomm NPU' };
const installLinks = {
  openvino: 'https://github.com/intel/linux-npu-driver',
  vitis: 'https://ryzenai.docs.amd.com/en/latest/linux.html',
};
const NPU_DRIVERS = { intel_vpu: 'openvino', amdxdna: 'vitis' };

/** NPUs bound to a kernel accel driver, read from `/sys/class/accel`. */
export function discoverNpus(base = '/sys/class/accel') {
  let devices;
  try {
    devices = readdirSync(base).filter((name) => /^accel\d+$/.test(name));
  } catch {
    return [];
  }
  const found = new Map();
  for (const device of devices) {
    try {
      const uevent = readFileSync(path.join(base, device, 'device/uevent'), 'utf8');
      const backend = NPU_DRIVERS[/^DRIVER=(.+)$/m.exec(uevent)?.[1]];
      // A bound driver is what makes the accel node exist; it is ready to use.
      if (backend) found.set(backend, true);
    } catch {
      /* A device without readable metadata is not offered. */
    }
  }
  return [...found].map(([backend, driverReady]) => ({ backend, driverReady }));
}

/** Ryzen AI Software ships its own Python; a configured path is used when present. */
function officialAmdPython() {
  return '';
}

export async function prepareIntelNpu() {
  // The OpenVINO venv recipe is in docs/linux/windows-heritage.md ("Python runtime provisioning").
  throw platformUnavailable('Intel NPU runtime preparation');
}

async function downloadPack(root, backend, pack, onProgress, download = downloadArtifact) {
  const base = path.join(root, 'data/models/npu', backend, pack.revision.slice(0, 12));
  const folder = noLinks(path.join(base, 'model'));
  const unlock = operationLock(base);
  try {
    mkdirSync(folder, { recursive: true });
    const total = pack.files.reduce((sum, file) => sum + file.bytes, 0);
    let completed = 0;
    for (const spec of pack.files) {
      const relative = safeFileName(spec.path);
      const target = noLinks(path.join(folder, relative));
      if (spec.bytes === 0) {
        mkdirSync(path.dirname(target), { recursive: true });
        try {
          writeFileSync(target, '', { flag: 'wx', mode: 0o600 });
        } catch (error) {
          if (error.code !== 'EEXIST') throw error;
          const info = lstatSync(target);
          if (!info.isFile() || info.nlink !== 1 || info.size !== 0) throw error;
        }
      } else {
        const blob = await download(
          {
            ...spec,
            url: `https://huggingface.co/${pack.repo}/resolve/${pack.revision}/${relative.split('/').map(encodeURIComponent).join('/')}`,
          },
          path.join(base, 'transfer'),
          {
            onProgress: (progress) =>
              onProgress(Math.floor((100 * (completed + progress.completed)) / total)),
            existingFile: target,
          },
        );
        if (blob !== target) {
          mkdirSync(path.dirname(target), { recursive: true });
          renameSync(blob, target);
        }
      }
      completed += spec.bytes;
      onProgress(Math.floor((100 * completed) / total));
    }
    return folder;
  } finally {
    unlock();
  }
}

export class NpuSetupService {
  constructor({
    root,
    discover = discoverNpus,
    amdPython = officialAmdPython,
    installIntel = prepareIntelNpu,
    downloadModel = downloadPack,
    Inference = NpuInference,
  }) {
    Object.assign(this, {
      root,
      discover,
      amdPython,
      installIntel,
      downloadModel,
      Inference,
    });
  }

  async options() {
    let saved;
    try {
      const config = readNpuSettings(this.root);
      if (existsSync(config.modelPath) && existsSync(npuPython(this.root, config)))
        saved = new this.Inference({ root: this.root, config });
    } catch {
      // Keep CPU/GPU selectable if the optional NPU settings are damaged.
    }
    const result = (await this.discover())
      .filter(({ backend }) => Object.hasOwn(packs, backend) && backend !== saved?.config.backend)
      .map(({ backend, driverReady }) => {
        const pack = packs[backend];
        const prerequisite = !driverReady
          ? driverRequired
          : backend === 'vitis' && !this.amdPython()
            ? amdRuntimeRequired
            : null;
        return {
          id: 'npu-setup-' + backend,
          name: labels[backend],
          backend: 'npu',
          available: !prerequisite,
          npuSetup: backend,
          model: pack.name,
          bytes: pack.files.reduce((sum, file) => sum + file.bytes, 0),
          reason: prerequisite,
          installLink: Boolean(prerequisite && installLinks[backend]),
        };
      });
    if (saved)
      result.unshift({
        id: saved.deviceId,
        name: labels[saved.config.backend],
        backend: 'npu',
        available: true,
      });
    return result;
  }

  openInstallGuide(backend, open) {
    if (!Object.hasOwn(installLinks, backend)) throw new Error('Unknown NPU installer.');
    return open(installLinks[backend]);
  }

  async prepare(deviceId) {
    if (this.status) throw new Error('NPU setup is already running.');
    this.status = { stage: 'runtime' };
    let candidate;
    try {
      const device = (await this.options()).find(({ id }) => id === deviceId);
      if (!device?.available) throw new Error(device?.reason ?? driverRequired);
      let config;
      if (device.npuSetup) {
        const backend = device.npuSetup;
        const pack = packs[backend];
        const python = backend === 'vitis' ? this.amdPython() : '';
        if (backend === 'vitis' && !python) throw new Error(amdRuntimeRequired);
        if (backend === 'openvino' && !npuPython(this.root, { backend, python }))
          await this.installIntel(this.root);
        const runtime = new this.Inference({
          root: this.root,
          config: { backend, python, modelPath: '' },
        });
        try {
          const probe = await runtime.probe();
          if (backend === 'openvino' && !probe.available) throw new Error(driverRequired);
        } finally {
          runtime.stop();
        }
        this.status = { stage: 'download', percent: 0 };
        const modelPath = await this.downloadModel(this.root, backend, pack, (percent) => {
          this.status = { stage: 'download', percent };
        });
        config = { backend, python, modelPath, contextTokens: pack.contextTokens };
      } else {
        config = readNpuSettings(this.root);
      }
      this.status = { stage: 'test' };
      candidate = new this.Inference({ root: this.root, config });
      if (!(await candidate.test())?.ready)
        throw new Error('The NPU could not generate a test reply.');
      return { config, deviceId: candidate.deviceId };
    } finally {
      candidate?.stop();
      this.status = null;
    }
  }
}
