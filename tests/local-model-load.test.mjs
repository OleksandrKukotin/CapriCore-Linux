// SPDX-License-Identifier: GPL-3.0-only
import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  LOCAL_LOAD_DEFAULTS,
  localLoadSettings,
  LocalLoadPolicy,
} from '../apps/desktop/local-model-load-policy.mjs';
import { LocalModelLoad } from '../apps/desktop/local-model-load.mjs';
const sample = (gpuPercent, cpuPercent = 3) => ({ members: 1, cpuPercent, gpuPercent });
const on = { enabled: true, percent: 60 };
function folder(t) {
  const value = mkdtempSync(path.join(tmpdir(), 'capri-load-limit-'));
  t.after(() => rmSync(value, { recursive: true, force: true }));
  return value;
}

test('load control defaults to 85%, validates bounds, and persists independently of providers', (t) => {
  assert.deepEqual(LOCAL_LOAD_DEFAULTS, { enabled: true, percent: 85 });
  for (const value of [
    null,
    [],
    { enabled: 'yes', percent: 85 },
    { enabled: true, percent: 9 },
    { enabled: true, percent: 101 },
    { enabled: true, percent: NaN },
    { ...on, pid: 1 },
  ])
    assert.throws(() => localLoadSettings(value));
  const root = folder(t),
    store = new LocalModelLoad({ root });
  assert.equal(store.snapshot().percent, 85);
  store.set({ enabled: false, percent: 35 });
  assert.equal(new LocalModelLoad({ root }).snapshot().percent, 35);
  assert.equal(new LocalModelLoad({ root }).snapshot().enabled, false);
  writeFileSync(store.file, 'invalid');
  assert.match(new LocalModelLoad({ root }).snapshot().warning, /restored/);
  assert.equal(readFileSync(store.file, 'utf8'), 'invalid');
});
test('CPU-only and missing GPU counters enforce the CPU ceiling without claiming a GPU reading', () => {
  const policy = new LocalLoadPolicy();
  assert.equal(policy.update(on, sample(null, 99)), 6000);
  assert.equal(policy.update({ ...on, percent: 85 }, sample(null, 99)), 8500);
  assert.equal(policy.update({ ...on, enabled: false }, sample(100, 99)), 10000);
  assert.equal(policy.update(on, sample(NaN)), 6000);
});
test('GPU feedback calibrates from measured demand, avoids duplicate drift and stays within the CPU cap', () => {
  const policy = new LocalLoadPolicy();
  for (let i = 0; i < 8; i++) policy.update(on, sample(90, 3));
  assert(policy.cap < 6000 && policy.cap >= 1);
  assert(policy.cap < 200);
  const lower = policy.cap;
  for (let i = 0; i < 12; i++) policy.update(on, sample(30, 3));
  assert(policy.cap > lower && policy.cap <= 6000);
  policy.update({ ...on, enabled: false }, sample(100));
  assert.equal(policy.frames, 0);
  assert.equal(policy.cap, 10000);
});
test('GPU feedback recovers after other GPU work ends, even from the smallest CPU quota', () => {
  const policy = new LocalLoadPolicy();
  for (let i = 0; i < 12; i++) policy.update(on, sample(100, 0.001));
  assert.equal(policy.cap, 1);
  for (let i = 0; i < 24; i++) policy.update(on, sample(0, 0));
  assert(policy.cap > 50, 'a quiet GPU must not leave inference stuck at a rounded tiny quota');
  assert(policy.cap <= 6000);
});
function lifecycle(t) {
  const root = folder(t),
    workers = [],
    resets = [];
  let clock = 0;
  const control = new LocalModelLoad({
    root,
    platform: 'win32',
    now: () => clock,
    runImpl: async (_file, args) => resets.push(args),
    spawnImpl: () => {
      const worker = new EventEmitter();
      worker.exitCode = null;
      worker.stdout = new EventEmitter();
      worker.stdout.setEncoding = () => {};
      worker.stdin = new EventEmitter();
      worker.stdin.destroyed = false;
      worker.stdin.write = () => {};
      worker.stdin.end = () =>
        setImmediate(() => {
          worker.exitCode = 0;
          worker.emit('close', 0);
        });
      worker.kill = () => {
        worker.exitCode = 1;
        worker.emit('close', 1);
      };
      workers.push(worker);
      const handle = String(40 + workers.length * 4);
      setImmediate(() =>
        worker.stdout.emit('data', JSON.stringify({ ready: true, jobHandle: handle }) + '\n'),
      );
      return worker;
    },
  });
  control.marker = () => ({
    pid: 123,
    startedAt: '123',
    executable: path.join(root, 'ollama.exe'),
  });
  control.prepare = async () => 'fixture-helper';
  t.after(() => control.close());
  return {
    control,
    workers,
    resets,
    advance: () => {
      clock += 10000;
    },
  };
}
const settle = () => new Promise((resolve) => setImmediate(resolve));

test('without a Linux backend the load control saves its setting but never claims enforcement', (t) => {
  const root = folder(t);
  const load = new LocalModelLoad({ root });
  assert.deepEqual(load.snapshot(), {
    ...LOCAL_LOAD_DEFAULTS,
    supported: false,
    state: 'unsupported',
    gpuAvailable: false,
    warning: null,
  });
  load.synchronize(true);
  assert.equal(load.set(on).percent, 60);
  assert.equal(new LocalModelLoad({ root }).snapshot().percent, 60);
  assert.equal(new LocalModelLoad({ root }).snapshot().supported, false);
});
