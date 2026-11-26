import { availableParallelism, totalmem, freemem, cpus, platform, arch, release } from 'node:os';
import { execFile } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { promisify } from 'node:util';
import path from 'node:path';
import { findExecutable } from '../host/paths.mjs';
const run = promisify(execFile);
const probeOptions = { timeout: 5000, maxBuffer: 65536, encoding: 'utf8' };
const softwareAdapter =
  /\b(?:software|microsoft basic render|microsoft remote display|remote display adapter)\b/i;
const memoryMiB = (value) =>
  typeof value === 'number' &&
  Number.isFinite(value) &&
  value > 0 &&
  value <= Number.MAX_SAFE_INTEGER
    ? value
    : null;
const gpuName = (value) =>
  typeof value === 'string' &&
  value.trim() &&
  value.length <= 256 &&
  !/[\x00-\x1f\x7f]/.test(value) &&
  !softwareAdapter.test(value)
    ? value.trim()
    : null;
const vendorOf = (value, name) =>
  ['nvidia', 'amd', 'intel'].includes(value)
    ? value
    : /nvidia/i.test(name)
      ? 'nvidia'
      : /amd|radeon/i.test(name)
        ? 'amd'
        : /intel/i.test(name)
          ? 'intel'
          : 'unknown';
const luidOf = (value) => {
  const match = typeof value === 'string' && /^0x([0-9a-f]{8})_0x([0-9a-f]{8})$/i.exec(value);
  return match ? `0x${match[1].toUpperCase()}_0x${match[2].toUpperCase()}` : null;
};
const freeMemoryMiB = (value, total) =>
  total !== null &&
  typeof value === 'number' &&
  Number.isFinite(value) &&
  value >= 0 &&
  value <= total
    ? value
    : null;
const PCI_VENDORS = { '0x1002': 'amd', '0x10de': 'nvidia', '0x8086': 'intel' };
const MiB = 1024 * 1024;
/** An APU's carve-out is small next to its GTT window; both are system RAM. */
const SHARED_CARVEOUT_MiB = 2048;

/**
 * Normalize one DRM card read from sysfs. Only amdgpu reports VRAM size and use;
 * other drivers (i915/xe integrated, nouveau) stay 'unknown' unless integrated.
 */
export function drmAdapter({ vendorId, deviceId, name, vramBytes, vramUsedBytes, gttBytes }) {
  const vendor = PCI_VENDORS[String(vendorId).toLowerCase()] ?? 'unknown';
  const label = gpuName(name) ?? gpuName(`${vendor.toUpperCase()} GPU [${vendorId}:${deviceId}]`);
  if (!label) return null;
  const vramMiB = memoryMiB(Math.floor(Number(vramBytes) / MiB));
  const gttMiB = memoryMiB(Math.floor(Number(gttBytes) / MiB));
  const integrated =
    vendor === 'intel' ||
    (vramMiB !== null && vramMiB <= SHARED_CARVEOUT_MiB && gttMiB !== null && gttMiB > vramMiB);
  const memoryKind = integrated ? 'shared' : vramMiB !== null ? 'dedicated' : 'unknown';
  const used = memoryMiB(Math.floor(Number(vramUsedBytes) / MiB));
  return {
    name: label,
    vendor,
    vramMiB: memoryKind === 'unknown' ? null : vramMiB,
    memoryKind,
    freeVramMiB:
      memoryKind === 'dedicated' && used !== null ? freeMemoryMiB(vramMiB - used, vramMiB) : null,
    cudaCandidate: false,
  };
}

/** Device names from the system PCI database (hwdata), when it is installed. */
function pciName(vendorId, deviceId, file = '/usr/share/hwdata/pci.ids') {
  try {
    const vendor = vendorId.replace(/^0x/, '').toLowerCase();
    const device = deviceId.replace(/^0x/, '').toLowerCase();
    const lines = readFileSync(file, 'utf8').split('\n');
    const start = lines.findIndex((line) => line.startsWith(vendor + '  '));
    if (start < 0) return null;
    for (const line of lines.slice(start + 1)) {
      if (!line.startsWith('\t')) break;
      if (line.startsWith('\t' + device + '  ')) return line.slice(device.length + 3).trim();
    }
  } catch {
    /* hwdata is optional. */
  }
  return null;
}

const readText = (file) => {
  try {
    return readFileSync(file, 'utf8').trim();
  } catch {
    return null;
  }
};

/** One DRM card (for example `card1`), or null when it is not a PCI GPU. */
export function readDrmCard(base, card) {
  const device = path.join(base, card, 'device');
  const vendorId = readText(path.join(device, 'vendor'));
  const deviceId = readText(path.join(device, 'device'));
  if (!vendorId || !deviceId) return null;
  return drmAdapter({
    vendorId,
    deviceId,
    name: pciName(vendorId, deviceId),
    vramBytes: readText(path.join(device, 'mem_info_vram_total')),
    vramUsedBytes: readText(path.join(device, 'mem_info_vram_used')),
    gttBytes: readText(path.join(device, 'mem_info_gtt_total')),
  });
}

export function drmCards(base = '/sys/class/drm') {
  try {
    return readdirSync(base).filter((entry) => /^card\d+$/.test(entry));
  } catch {
    return [];
  }
}

export function readDrmInventory(base = '/sys/class/drm') {
  return drmCards(base)
    .map((card) => readDrmCard(base, card))
    .filter(Boolean);
}
export function parseNvidia(text) {
  if (typeof text !== 'string') return [];
  return text
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .flatMap((line) => {
      const fields = line.split(',').map((x) => x.trim()),
        driver = fields.pop(),
        memory = memoryMiB(Number(fields.pop())),
        name = gpuName(fields.join(', '));
      return name && memory !== null
        ? [
            {
              name,
              vendor: 'nvidia',
              vramMiB: memory,
              memoryKind: 'dedicated',
              driver,
              cudaCandidate: true,
            },
          ]
        : [];
    });
}
const nameKey = (name) =>
  name
    .replace(/[®™]/g, '')
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^nvidia\s+/i, '')
    .toLowerCase();
/** Keep each physical adapter separate; NVIDIA's driver-reported total takes precedence. */
export function mergeGpuInventory(native, nvidia) {
  const remaining = [...native];
  const drivers = [...nvidia];
  const merged = [];
  const join = (gpu, native) => ({
    ...native,
    ...gpu,
    ...(native?.luid || luidOf(gpu.luid) ? { luid: native?.luid ?? luidOf(gpu.luid) } : {}),
    freeVramMiB: freeMemoryMiB(gpu.freeVramMiB ?? native?.freeVramMiB, gpu.vramMiB),
  });
  const take = (gpu, native) => {
    merged.push(join(gpu, native));
    drivers.splice(drivers.indexOf(gpu), 1);
    remaining.splice(remaining.indexOf(native), 1);
  };
  // Driver order and sysfs order need not agree, even for the same model name.
  for (const gpu of [...drivers]) {
    const luid = luidOf(gpu.luid);
    const native = luid && remaining.find((item) => item.vendor === 'nvidia' && item.luid === luid);
    if (native) take(gpu, native);
  }
  const compatible = (gpu, native) =>
    native.vendor === 'nvidia' &&
    !(luidOf(gpu.luid) && native.luid && luidOf(gpu.luid) !== native.luid) &&
    nameKey(native.name) === nameKey(gpu.name) &&
    (memoryMiB(native.vramMiB) === null || Math.abs(native.vramMiB - gpu.vramMiB) <= 128);
  const distance = (gpu, native) =>
    memoryMiB(native.vramMiB) === null ? Infinity : Math.abs(native.vramMiB - gpu.vramMiB);
  const closest = (items, score) => {
    const best = Math.min(...items.map(score));
    const matches = items.filter((item) => score(item) === best);
    return matches.length === 1 ? matches[0] : null;
  };
  // Require the nearest match to be unique in both directions. Equal-capacity
  // cards cannot acquire each other's LUID or free-memory counter by row order.
  let matched;
  do {
    matched = false;
    for (const gpu of drivers) {
      const native = closest(
        remaining.filter((item) => compatible(gpu, item)),
        (item) => distance(gpu, item),
      );
      if (!native) continue;
      const reciprocal = closest(
        drivers.filter((item) => compatible(item, native)),
        (item) => distance(item, native),
      );
      if (reciprocal !== gpu) continue;
      take(gpu, native);
      matched = true;
      break;
    }
  } while (matched);
  const anonymous = (gpu) => ({ ...gpu, luid: null, freeVramMiB: null });
  while (drivers.length) {
    const group = new Set([drivers[0]]),
      natives = new Set();
    for (const gpu of group) {
      for (const native of remaining.filter((item) => compatible(gpu, item))) {
        natives.add(native);
        for (const other of drivers.filter((item) => compatible(item, native))) group.add(other);
      }
    }
    if (!natives.size) {
      merged.push(join(drivers.shift(), null));
      continue;
    }
    const known = [...natives].every((gpu) => gpu.memoryKind === 'dedicated');
    if (known) {
      // Their original DXGI identities/counters are valid; leave them untouched.
      merged.push(...natives);
      const surplus = Math.max(0, group.size - natives.size);
      merged.push(
        ...[...group]
          .sort((a, b) => a.vramMiB - b.vramMiB)
          .slice(0, surplus)
          .map(anonymous),
      );
    } else {
      // SMI still establishes dedicated capacity when UMA detection is unknown,
      // but it cannot establish which native LUID belongs to which driver row.
      merged.push(...[...group].map(anonymous));
      for (let i = group.size; i < natives.size; i++)
        merged.push({ ...anonymous([...natives][0]), vramMiB: null, memoryKind: 'unknown' });
    }
    for (const gpu of group) drivers.splice(drivers.indexOf(gpu), 1);
    for (const native of natives) remaining.splice(remaining.indexOf(native), 1);
  }
  return [...merged, ...remaining];
}
export async function probeHardware({
  runCommand = run,
  locateExecutable = findExecutable,
  platform: hostPlatform = platform(),
  arch: hostArch = arch(),
  env = process.env,
  readGpus = readDrmInventory,
} = {}) {
  const report = {
    platform: hostPlatform,
    arch: hostArch,
    osRelease: release(),
    cpu: cpus()[0]?.model ?? 'Unknown',
    cpuThreads: availableParallelism(),
    ramBytes: totalmem(),
    availableRamBytes: freemem(),
    gpus: [],
    warnings: [],
  };
  const nvidia = locateExecutable('nvidia-smi', { env, platform: hostPlatform });
  const queryNvidia = async () => {
    if (!nvidia) return [];
    try {
      const { stdout } = await runCommand(
        nvidia,
        ['--query-gpu=name,memory.total,driver_version', '--format=csv,noheader,nounits'],
        { ...probeOptions, env },
      );
      return parseNvidia(stdout);
    } catch {
      report.warnings.push('NVIDIA driver query unavailable; driver details may be unknown.');
      return [];
    }
  };
  const nvidiaGpus = await queryNvidia();
  // The NVIDIA driver row is authoritative; sysfs has no VRAM facts for it.
  const nativeGpus = readGpus().filter((gpu) => !(gpu.vendor === 'nvidia' && nvidiaGpus.length));
  report.gpus = mergeGpuInventory(nativeGpus, nvidiaGpus);
  if (report.platform !== 'linux' || report.arch !== 'x64')
    report.warnings.push('The desktop is currently qualified for Linux x64 only.');
  return report;
}
