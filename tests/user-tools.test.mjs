import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdirSync,
  mkdtempSync,
  writeFileSync,
  readFileSync,
  copyFileSync,
  realpathSync,
  rmSync,
} from 'node:fs';
import path from 'node:path';
import { UserTools } from '../apps/desktop/user-tools.mjs';
import { toolManifest, validateToolArguments } from '../apps/desktop/tool-manifest.mjs';
const parent = path.resolve('.runtime/0.6.2/tool-tests');
mkdirSync(parent, { recursive: true });
// Use an owned copy of the runtime so tests never touch the host's.
const root = mkdtempSync(path.join(parent, 'suite-'));
const node = path.join(root, '.runtime/node', path.basename(process.execPath));
mkdirSync(path.dirname(node), { recursive: true });
copyFileSync(process.execPath, node);
after(() => {
  const resolved = realpathSync(root);
  assert.equal(path.dirname(resolved), realpathSync(parent));
  assert.match(path.basename(resolved), /^suite-/);
  rmSync(resolved, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
});
const manifest = {
  version: 1,
  name: 'owned_tool',
  description: 'A synthetic test tool.',
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: { text: { type: 'string', maxLength: 100 } },
  },
  runtime: 'node',
  entry: 'main.mjs',
  permissions: { network: false, files: 'none' },
  timeoutMs: 1000,
};
const storage = {
  available: async () => true,
  encrypt: async (text) => Buffer.from(text).map((byte) => byte ^ 0xa5),
  decrypt: async (bytes) =>
    Buffer.from(bytes)
      .map((byte) => byte ^ 0xa5)
      .toString(),
};
function fixture(runner) {
  const data = mkdtempSync(path.join(root, 'case-')),
    state = path.join(data, 'state');
  mkdirSync(state);
  return new UserTools({
    root,
    data,
    state,
    node,
    storage,
    runner,
  });
}
async function install(tools, value = manifest, code = 'console.log("{}")') {
  await tools.ready;
  const folder = path.join(tools.folder, 'example');
  mkdirSync(folder);
  writeFileSync(path.join(folder, 'manifest.json'), JSON.stringify(value));
  writeFileSync(path.join(folder, 'main.mjs'), code);
  await tools.refresh();
}
test('tools never run on discovery, validate arguments, bind approval to all code and keep settings away from model definitions', async () => {
  let calls = 0;
  const tools = fixture(async ({ parameters, settings }) => {
    calls++;
    return { text: parameters.text, echo: settings.apiKey };
  });
  try {
    await install(tools);
    assert.equal(calls, 0);
    await assert.rejects(tools.run('example', {}));
    await tools.enable('example', true);
    await tools.saveSettings('example', { apiKey: 'synthetic-private-api-value' });
    assert(!readFileSync(tools.publicFile, 'utf8').includes('synthetic-private'));
    assert(!readFileSync(tools.secretFile, 'utf8').includes('synthetic-private'));
    assert.deepEqual(await tools.run('example', { text: 'hello' }), {
      text: 'hello',
      echo: '[redacted]',
    });
    await assert.rejects(tools.run('example', { unknown: 'x' }));
    writeFileSync(path.join(tools.folder, 'example/main.mjs'), 'console.log("changed")');
    await assert.rejects(tools.run('example', {}), /code changed/);
    assert.equal(calls, 1);
  } finally {
    tools.close();
  }
});
test('context scripts only run on matching keywords, cache output and are disabled after code changes', async () => {
  let calls = 0;
  const tools = fixture(async () => {
    calls++;
    return { weather: 'sunny' };
  });
  try {
    await install(tools, {
      ...manifest,
      mode: 'context',
      keywords: ['forecast'],
      cacheSeconds: 30,
    });
    await tools.enable('example', true);
    assert.equal(await tools.context('hello'), '');
    assert.equal(calls, 0);
    assert.match(await tools.context('forecast please'), /sunny/);
    await tools.context('forecast again');
    assert.equal(calls, 1);
    writeFileSync(path.join(tools.folder, 'example/main.mjs'), 'changed');
    await tools.refresh();
    assert.equal(await tools.context('forecast'), '');
  } finally {
    tools.close();
  }
});
test('unsupported schemas, shell commands and prototype-like parameters are rejected', () => {
  assert.throws(() => toolManifest({ ...manifest, command: 'cmd /c echo x' }));
  assert.throws(() =>
    toolManifest({ ...manifest, parameters: { $ref: 'https://untrusted.invalid' } }),
  );
  assert.throws(() => validateToolArguments(JSON.parse('{"__proto__":"x"}'), manifest.parameters));
});
