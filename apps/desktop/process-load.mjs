// SPDX-License-Identifier: GPL-3.0-only
import { readdirSync, readFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';

const unavailable = { cpuPercent: null, ramBytes: null, vramBytes: null };
const bytes = (value) => (Number.isSafeInteger(value) && value >= 0 ? value : null);
// USER_HZ is 100 on every mainstream Linux architecture.
const TICK_MS = 10;

/** One /proc/<pid>/stat record: parent, CPU time and start time (in ticks). */
function procStat(pid, base) {
  const text = readFileSync(`${base}/${pid}/stat`, 'utf8');
  const fields = text.slice(text.lastIndexOf(')') + 2).split(' ');
  return {
    ppid: Number(fields[1]),
    cpuMs: (Number(fields[11]) + Number(fields[12])) * TICK_MS,
    started: fields[19],
  };
}

function residentBytes(pid, base) {
  const match = /^VmRSS:\s+(\d+) kB$/m.exec(readFileSync(`${base}/${pid}/status`, 'utf8'));
  return match ? Number(match[1]) * 1024 : 0;
}

/** Capri's own process tree (this process and all descendants) from /proc. */
export function readProcessTree(rootPid, base = '/proc') {
  const stats = new Map();
  for (const entry of readdirSync(base)) {
    if (!/^\d+$/.test(entry)) continue;
    try {
      stats.set(Number(entry), procStat(entry, base));
    } catch {
      /* The process exited during the walk. */
    }
  }
  const children = new Map();
  for (const [pid, stat] of stats) {
    if (!children.has(stat.ppid)) children.set(stat.ppid, []);
    children.get(stat.ppid).push(pid);
  }
  const processes = [];
  let ramBytes = 0;
  for (const queue = [rootPid]; queue.length; ) {
    const pid = queue.shift();
    const stat = stats.get(pid);
    if (!stat) continue;
    try {
      ramBytes += residentBytes(pid, base);
    } catch {
      continue;
    }
    processes.push({ pid, started: stat.started, cpuMs: stat.cpuMs });
    queue.push(...(children.get(pid) ?? []));
  }
  // Per-process VRAM needs DRM fdinfo; it is reported as unknown for now.
  return { processes, ramBytes, vramBytes: null };
}

export class ProcessLoadSampler {
  constructor({
    pid = process.pid,
    now = () => performance.now(),
    cores = availableParallelism(),
    read = () => readProcessTree(pid),
  } = {}) {
    Object.assign(this, { now, cores, read });
    this.generation = 0;
  }

  stop() {
    this.generation++;
    this.previous = null;
    this.retryAt = 0;
  }

  sample() {
    if (!this.pending) {
      if (this.retryAt > this.now()) return Promise.resolve(unavailable);
      const generation = this.generation;
      this.pending = Promise.resolve()
        .then(this.read)
        .then((reading) => {
          if (generation !== this.generation) return unavailable;
          const at = this.now();
          const cpu = new Map();
          for (const process of reading.processes) {
            if (
              Number.isSafeInteger(process.pid) &&
              /^\d+$/.test(process.started) &&
              Number.isFinite(process.cpuMs) &&
              process.cpuMs >= 0
            )
              cpu.set(process.pid + '/' + process.started, process.cpuMs);
          }
          if (!cpu.size) throw new Error('No Capri processes in sample');
          const elapsed = at - this.previous?.at;
          let used = 0;
          let matches = 0;
          if (elapsed > 0 && elapsed <= 20000)
            for (const [id, total] of cpu) {
              const before = this.previous.cpu.get(id);
              if (before === undefined || total < before) continue;
              used += total - before;
              matches++;
            }
          this.previous = { at, cpu };
          return {
            cpuPercent: matches ? Math.min(100, (100 * used) / (elapsed * this.cores)) : null,
            ramBytes: bytes(reading.ramBytes),
            vramBytes: bytes(reading.vramBytes),
          };
        })
        .catch(() => {
          if (generation === this.generation) {
            this.stop();
            this.retryAt = this.now() + 30000;
          }
          return unavailable;
        })
        .finally(() => {
          this.pending = null;
        });
    }
    return this.pending;
  }
}
