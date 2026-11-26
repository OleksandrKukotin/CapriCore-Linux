// SPDX-License-Identifier: GPL-3.0-only
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { discoverNpus, NpuSetupService } from '../apps/desktop/npu-setup-service.mjs';
import { ModelDeviceService } from '../apps/desktop/model-device-service.mjs';
import { npuSettings, validateNpuModel } from '../packages/runtime/src/providers/npu-settings.mjs';
import { NpuInference, NpuWorker } from '../packages/runtime/src/providers/npu-inference.mjs';
import {
  saveModelDevices,
  readModelDevices,
  modelsShareDevice,
} from '../packages/runtime/src/model-device-settings.mjs';
import { managedPython } from '../packages/installer/src/python-runtime.mjs';
const fixture = (t) => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'capri-npu-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const modelPath = path.join(root, 'model');
  mkdirSync(modelPath);
  for (const name of ['openvino_model', 'openvino_tokenizer', 'openvino_detokenizer']) {
    writeFileSync(path.join(modelPath, name + '.xml'), '<net/>');
    writeFileSync(path.join(modelPath, name + '.bin'), '0');
  }
  return { root, config: npuSettings({ modelPath }) };
};
test('native model selection does not share GPU voice memory or allow NPU voice', (t) => {
  const { root, config } = fixture(t),
    native = new NpuInference({ root, config });
  saveModelDevices(root, { language: native.deviceId, voice: 'auto' });
  assert.equal(readModelDevices(root).language, native.deviceId);
  assert.equal(modelsShareDevice(native.deviceId, 'auto'), false);
  assert.throws(() => saveModelDevices(root, { language: 'auto', voice: native.deviceId }));
});
test('NPU discovery reads bound accel drivers from sysfs and ignores other devices', (t) => {
  const base = mkdtempSync(path.join(os.tmpdir(), 'capri-accel-'));
  t.after(() => rmSync(base, { recursive: true, force: true }));
  const device = (name, uevent) => {
    mkdirSync(path.join(base, name, 'device'), { recursive: true });
    if (uevent !== null) writeFileSync(path.join(base, name, 'device/uevent'), uevent);
  };
  device('accel0', 'DRIVER=amdxdna\nPCI_ID=1022:17F0\n');
  device('accel1', 'DRIVER=intel_vpu\n');
  device('accel2', 'DRIVER=habanalabs\n');
  device('accel3', null);
  device('card0', 'DRIVER=amdxdna\n');
  assert.deepEqual(discoverNpus(base), [
    { backend: 'vitis', driverReady: true },
    { backend: 'openvino', driverReady: true },
  ]);
  assert.deepEqual(discoverNpus(path.join(base, 'missing')), []);
});
test('AMD NPU appears alongside CPU/GPU and prepares a compatible model before it can be activated', async (t) => {
  const { root, config } = fixture(t);
  let python = '',
    ready = false;
  const steps = [];
  class Inference {
    constructor({ config: selected }) {
      this.config = selected;
      this.deviceId = 'npu-vitis:0:0123456789abcdef';
    }
    async test() {
      steps.push('test');
      assert.equal(this.config.python, python);
      assert.equal(this.config.contextTokens, 4096);
      assert.equal(setup.status.stage, 'test');
      return { ready };
    }
    async probe() {
      steps.push('probe');
      return { available: false, requiresHardwareCheck: true };
    }
    stop() {
      if (this.config.modelPath) steps.push('stop');
    }
  }
  const setup = new NpuSetupService({
    root,
    build: () => 26100,
    discover: () => [{ backend: 'vitis', driverReady: true }],
    amdPython: () => python,
    installIntel: () => assert.fail('AMD must not install Intel OpenVINO'),
    downloadModel: (_root, backend, pack, progress) => {
      steps.push('download');
      assert.equal(backend, 'vitis');
      assert.match(pack.repo, /^amd\//);
      assert.equal(setup.status.stage, 'download');
      progress(66);
      assert.equal(setup.status.percent, 66);
      return config.modelPath;
    },
    Inference,
  });
  const catalog = new ModelDeviceService({
    root,
    npuSetup: setup,
    languageProbe: () => [],
    hardware: () => ({ gpus: [] }),
  });
  const id = 'npu-setup-vitis';
  assert.deepEqual(
    (await catalog.refresh()).options.language.map(({ id }) => id),
    ['auto', 'cpu', id],
  );
  assert.equal((await catalog.refresh()).options.language.at(-1).installLink, true);
  assert.ok(!(await catalog.refresh()).options.voice.some(({ id: voice }) => voice === id));
  await assert.rejects(setup.prepare(id), /Install AMD Ryzen AI Software/);
  assert.deepEqual(steps, []);
  python = path.join(root, 'vendor/python.exe');
  await catalog.validate({ language: id, voice: 'auto' });
  await assert.rejects(setup.prepare(id), /could not generate a test reply/);
  assert.equal(readModelDevices(root).language, 'auto');
  assert.equal(setup.status, null);
  ready = true;
  assert.equal((await setup.prepare(id)).deviceId, 'npu-vitis:0:0123456789abcdef');
  assert.deepEqual(steps, [
    'probe',
    'download',
    'test',
    'stop',
    'probe',
    'download',
    'test',
    'stop',
  ]);
});
test('converted models reject executable payloads, entity XML and outside tensor paths', (t) => {
  const { config } = fixture(t);
  assert.ok(validateNpuModel(config).bytes > 0);
  writeFileSync(path.join(config.modelPath, 'plugin.dll'), 'data');
  assert.throws(() => validateNpuModel(config), { code: 'CAPRI_NPU_MODEL_INVALID' });
  rmSync(path.join(config.modelPath, 'plugin.dll'));
  writeFileSync(
    path.join(config.modelPath, 'openvino_model.xml'),
    '<!ENTITY x SYSTEM "file:///secret"><net/>',
  );
  assert.throws(() => validateNpuModel(config));
  writeFileSync(
    path.join(config.modelPath, 'genai_config.json'),
    JSON.stringify({ filename: '../secret' }),
  );
  assert.throws(() => validateNpuModel({ ...config, backend: 'vitis' }));
});
test('native inference streams over private IPC and keeps cloud/API mode out of selection', async (t) => {
  const { root, config } = fixture(t),
    operations = [];
  class Worker {
    async request(op, value, options = {}) {
      operations.push(op);
      if (op === 'generate') options.delta('Ready');
      return { ready: true };
    }
    stop() {
      this.onStop?.();
    }
  }
  const native = new NpuInference({ root, config, Worker });
  const response = await native.fetch('http://unused/v1/chat/completions', {
    body: JSON.stringify({ messages: [{ role: 'user', content: 'Hi' }] }),
  });
  assert.match(await response.text(), /Ready/);
  assert.deepEqual(operations, ['load', 'generate']);
  native.stop();
  await native.ready();
  assert.equal(operations.filter((op) => op === 'load').length, 2);
  await assert.rejects(
    native.fetch('http://unused/api/chat', {
      body: JSON.stringify({ messages: [{ role: 'user', content: [{ type: 'image' }] }] }),
    }),
    { code: 'CAPRI_NPU_INPUT_INVALID' },
  );
});
test('real worker returns a safe missing-runtime error without SDK paths or prompts', async (t) => {
  const root = path.resolve('.'),
    python = managedPython(root, '3.11.17');
  if (!existsSync(python)) return t.skip('Private Python is not installed');
  const worker = new NpuWorker({ root, python });
  t.after(() => worker.stop());
  await assert.rejects(worker.request('probe', { backend: 'openvino' }), {
    code: 'CAPRI_NPU_RUNTIME_MISSING',
  });
  await assert.rejects(worker.request('probe', { backend: 'qnn' }), {
    code: 'CAPRI_NPU_RUNTIME_MISSING',
  });
});
test('prepared OpenVINO discovers real hardware without a background-import deadlock', async (t) => {
  const root = path.resolve('.'),
    python = path.join(root, '.runtime/npu-openvino/bin/python');
  if (!existsSync(python)) return t.skip('Optional OpenVINO runtime is not prepared');
  const worker = new NpuWorker({ root, python });
  t.after(() => worker.stop());
  const result = await worker.request('probe', { backend: 'openvino' }, { timeoutMs: 15000 });
  assert.equal(result.backend, 'openvino');
  assert.equal(typeof result.available, 'boolean');
  assert.ok(result.devices.every((device) => device.split('.')[0] === 'NPU'));
});
