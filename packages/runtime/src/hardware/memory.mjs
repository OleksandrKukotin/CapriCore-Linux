// SPDX-License-Identifier: GPL-3.0-only
import { freemem, totalmem } from 'node:os';
import { execFile } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { promisify } from 'node:util';
import path from 'node:path';
import { findExecutable } from '../host/paths.mjs';
import { drmCards, readDrmCard } from './probe.mjs';

const run = promisify(execFile);
const MiB = 1024 ** 2;
export function memoryUsage(total, free) {
  if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(free) || free < 0 || free > total)
    return null;
  return {
    totalBytes: total,
    freeBytes: free,
    usedBytes: total - free,
    percent: (100 * (total - free)) / total,
  };
}
function measurement(text, min, max) {
  if (!/^-?\d+(?:\.\d+)?$/.test(text)) return null;
  const value = Number(text);
  return value >= min && value <= max ? value : null;
}
export function parseGpuMemory(stdout, { telemetry = false } = {}) {
  return String(stdout)
    .trim()
    .split(/\r?\n/)
    .flatMap((line) => {
      const fields = line.split(',').map((part) => part.trim());
      const index = fields.shift(),
        uuid = fields.shift();
      const utilization = telemetry ? measurement(fields.pop(), 0, 100) : null;
      const temperatureCelsius = telemetry ? measurement(fields.pop(), -20, 150) : null;
      const free = fields.pop(),
        total = fields.pop();
      const name = fields.join(', ');
      const usage =
        /^\d+(?:\.\d+)?$/.test(total) && /^\d+(?:\.\d+)?$/.test(free)
          ? memoryUsage(Number(total) * MiB, Number(free) * MiB)
          : null;
      return usage && /^\d+$/.test(index) && uuid && name
        ? [
            {
              id: uuid,
              index: Number(index),
              name,
              vendor: 'nvidia',
              ...usage,
              ...(telemetry ? { utilization, temperatureCelsius } : {}),
            },
          ]
        : [];
    });
}
async function readNvidiaMemory() {
  const executable = findExecutable('nvidia-smi');
  if (!executable) return [];
  const { stdout } = await run(
    executable,
    [
      '--query-gpu=index,uuid,name,memory.total,memory.free,temperature.gpu,utilization.gpu',
      '--format=csv,noheader,nounits',
    ],
    { timeout: 2500, maxBuffer: 65536 },
  );
  return parseGpuMemory(stdout, { telemetry: true });
}

/**
 * Live readings from DRM sysfs. amdgpu reports VRAM use, busy percent and a
 * hwmon temperature; other drivers expose no memory counters and are skipped.
 */
export function readDrmMemory(base = '/sys/class/drm') {
  const number = (file) => {
    try {
      const text = readFileSync(file, 'utf8').trim();
      return /^\d+$/.test(text) ? Number(text) : null;
    } catch {
      return null;
    }
  };
  return drmCards(base).flatMap((card) => {
    const device = path.join(base, card, 'device');
    const adapter = readDrmCard(base, card);
    const total = number(path.join(device, 'mem_info_vram_total'));
    const used = number(path.join(device, 'mem_info_vram_used'));
    if (!adapter || total === null || used === null || used > total) return [];
    let temperature = null;
    try {
      const monitor = readdirSync(path.join(device, 'hwmon'))[0];
      const milli = monitor && number(path.join(device, 'hwmon', monitor, 'temp1_input'));
      if (milli !== null && milli >= -20000 && milli <= 150000) temperature = milli / 1000;
    } catch {
      /* No hwmon sensor for this card. */
    }
    const busy = number(path.join(device, 'gpu_busy_percent'));
    return [
      {
        id: 'drm-' + card,
        name: adapter.name,
        vendor: adapter.vendor,
        memoryKind: adapter.memoryKind,
        ...memoryUsage(total, total - used),
        utilization: busy !== null && busy <= 100 ? busy : null,
        temperatureCelsius: temperature,
      },
    ];
  });
}

export function mergeGpuReadings(nvidia, native) {
  return [...nvidia, ...native.filter((gpu) => gpu.vendor !== 'nvidia' || !nvidia.length)];
}
async function readGpuMemory() {
  const [driver, native] = await Promise.allSettled([
    readNvidiaMemory(),
    Promise.resolve().then(() => readDrmMemory()),
  ]);
  return mergeGpuReadings(
    driver.status === 'fulfilled' ? driver.value : [],
    native.status === 'fulfilled' ? native.value : [],
  );
}

/** Read-only, bounded and shared by all callers. No timer or model loads.
 * An unavailable/failed driver is unknown, never zero usage or a stale sample. */
export class MemorySampler {
  constructor({
    readGpu = readGpuMemory,
    ram = () => memoryUsage(totalmem(), freemem()),
    now = Date.now,
  } = {}) {
    Object.assign(this, { readGpu, ram, now });
    this.nextGpuAt = 0;
    this.gpus = [];
  }
  async sample({ fresh = false } = {}) {
    if (!this.pending && (fresh || this.now() >= this.nextGpuAt)) {
      this.pending = Promise.resolve()
        .then(() => this.readGpu())
        .then(
          (gpus) => {
            this.gpus = gpus;
            this.gpuSampledAt = this.now();
            this.nextGpuAt = this.now() + (gpus.length ? 2000 : 30000);
          },
          () => {
            this.gpus = [];
            this.gpuSampledAt = null;
            this.nextGpuAt = this.now() + 30000;
          },
        )
        .finally(() => {
          this.pending = null;
        });
    }
    await this.pending;
    return {
      sampledAt: this.now(),
      gpuSampledAt: this.gpuSampledAt ?? null,
      ram: this.ram(),
      gpus: this.gpus.map((gpu) => ({ ...gpu })),
    };
  }
}
export const memorySampler = new MemorySampler();
