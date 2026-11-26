// SPDX-License-Identifier: GPL-3.0-only
import { readdir, readFile, statfs } from 'node:fs/promises';
import { cpus } from 'node:os';
import path from 'node:path';
import { memoryUsage } from '../../packages/runtime/src/hardware/memory.mjs';

export async function resourceDiskUsage(volumePath, readVolume = statfs) {
  try {
    const { blocks, bfree, bsize } = await readVolume(volumePath);
    return memoryUsage(blocks * bsize, bfree * bsize);
  } catch {
    return null;
  }
}

function cpuTimes() {
  const cores = cpus();
  return {
    cores: cores.length,
    idle: cores.reduce((sum, { times }) => sum + times.idle, 0),
    total: cores.reduce(
      (sum, { times }) => sum + Object.values(times).reduce((total, ticks) => total + ticks, 0),
      0,
    ),
  };
}

function loadPercent(previous, current) {
  if (!previous || previous.cores !== current.cores) return null;
  const total = current.total - previous.total;
  const idle = current.idle - previous.idle;
  return total > 0 && idle >= 0 && idle <= total ? (100 * (total - idle)) / total : null;
}

// CPU package sensors, best first: AMD (k10temp, zenpower), Intel (coretemp),
// ARM SoCs (cpu_thermal). Labels pick the package/die reading over single cores.
const CPU_SENSORS = ['k10temp', 'zenpower', 'coretemp', 'cpu_thermal'];
const PACKAGE_LABEL = /^(?:Tdie|Tctl|Package id \d+)$/;

/** Choose the CPU package temperature from hwmon readings `{ chip, label, celsius }`. */
export function cpuPackageTemperature(readings) {
  let best = null;
  let bestRank = Infinity;
  for (const { chip, label, celsius } of readings) {
    const chipRank = CPU_SENSORS.indexOf(chip);
    if (chipRank < 0 || !Number.isFinite(celsius) || celsius < -20 || celsius > 150) continue;
    // Prefer Tdie over Tctl: Tctl carries a cooling offset on some Ryzen parts.
    const labelRank = label === 'Tdie' ? 0 : PACKAGE_LABEL.test(label ?? '') ? 1 : 2;
    const rank = chipRank * 10 + labelRank;
    if (rank < bestRank) {
      best = celsius;
      bestRank = rank;
    }
  }
  return best === null ? null : Math.round(best * 10) / 10;
}

export async function readCpuTemperature(base = '/sys/class/hwmon') {
  const readings = [];
  for (const monitor of await readdir(base).catch(() => [])) {
    const folder = path.join(base, monitor);
    const chip = (await readFile(path.join(folder, 'name'), 'utf8').catch(() => '')).trim();
    if (!CPU_SENSORS.includes(chip)) continue;
    for (const entry of await readdir(folder).catch(() => [])) {
      const match = /^temp(\d+)_input$/.exec(entry);
      if (!match) continue;
      const value = (await readFile(path.join(folder, entry), 'utf8').catch(() => '')).trim();
      const label = (
        await readFile(path.join(folder, `temp${match[1]}_label`), 'utf8').catch(() => '')
      ).trim();
      if (/^-?\d+$/.test(value)) readings.push({ chip, label, celsius: Number(value) / 1000 });
    }
  }
  return cpuPackageTemperature(readings);
}

/** Sample on demand, sharing a bounded sensor read with concurrent callers. */
export class CpuSampler {
  constructor({ readTimes = cpuTimes, readTemperature = readCpuTemperature, now = Date.now } = {}) {
    Object.assign(this, { readTimes, readTemperature, now });
    this.temperatureCelsius = null;
    this.temperatureSampledAt = null;
    this.nextTemperatureAt = 0;
  }

  async sample({ awaitTemperature = true } = {}) {
    const current = this.readTimes();
    const utilization = loadPercent(this.previous, current);
    if (!this.previous || current.total !== this.previous.total) this.previous = current;
    if (!this.pending && this.now() >= this.nextTemperatureAt) {
      this.pending = Promise.resolve()
        .then(this.readTemperature)
        .catch(() => null)
        .then((reading) => {
          this.temperatureCelsius = Number.isFinite(reading) ? reading : null;
          this.temperatureSampledAt = this.temperatureCelsius === null ? null : this.now();
          this.nextTemperatureAt = this.now() + (this.temperatureCelsius === null ? 60000 : 10000);
        })
        .finally(() => (this.pending = null));
    }
    if (awaitTemperature) await this.pending;
    return {
      utilization,
      temperatureCelsius: this.temperatureCelsius,
      temperatureSampledAt: this.temperatureSampledAt,
    };
  }

  stop() {
    this.previous = null;
  }
}
