// SPDX-License-Identifier: GPL-3.0-only
import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import {
  claudeArguments,
  browserRequest,
  createClaudeCodeBridge,
  promptFromMessages,
  runClaude,
} from '../packages/runtime/src/providers/claude-code-bridge.mjs';

/** A stand-in for the claude process that prints the given stream-json events. */
function fakeClaude(events, { code = 0, hold = false } = {}) {
  const calls = [];
  const spawnProcess = (file, args, options) => {
    const child = new EventEmitter();
    child.stdin = new PassThrough();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.exitCode = null;
    child.kill = (signal) => {
      child.killed = signal;
      child.exitCode = 143;
      child.emit('close', 143);
    };
    let input = '';
    child.stdin.on('data', (chunk) => (input += chunk));
    child.stdin.on('end', () => {
      calls.push({ file, args, options, input, child });
      if (hold) return;
      for (const event of events) child.stdout.write(JSON.stringify(event) + '\n');
      child.stdout.end();
      child.exitCode = code;
      setImmediate(() => child.emit('close', code));
    });
    return child;
  };
  return { spawnProcess, calls };
}
const delta = (text) => ({
  type: 'stream_event',
  event: { type: 'content_block_delta', delta: { type: 'text_delta', text } },
});
const success = {
  type: 'result',
  subtype: 'success',
  is_error: false,
  result: 'Hey there!',
  usage: { input_tokens: 2, cache_creation_input_tokens: 10, output_tokens: 3 },
};

test('Claude runs with no tools, MCP servers, settings or saved session', () => {
  const args = claudeArguments({ model: 'haiku', system: 'Be Capri.' });
  assert.deepEqual(args.slice(args.indexOf('--tools'), args.indexOf('--tools') + 2), [
    '--tools',
    '',
  ]);
  for (const flag of ['--strict-mcp-config', '--no-session-persistence', '--setting-sources'])
    assert(args.includes(flag), flag);
  assert.equal(args[args.indexOf('--model') + 1], 'haiku');
  assert.equal(args[args.indexOf('--system-prompt') + 1], 'Be Capri.');
  assert.equal(claudeArguments({}).includes('--model'), false);
});

test('chat history becomes one system prompt and a labelled transcript', () => {
  assert.deepEqual(
    promptFromMessages([
      { role: 'system', content: 'You are Capri.' },
      { role: 'user', content: 'Hi' },
    ]),
    { system: 'You are Capri.', prompt: 'Hi' },
  );
  const { system, prompt } = promptFromMessages([
    { role: 'system', content: 'Persona.' },
    { role: 'developer', content: 'Rules.' },
    { role: 'user', content: [{ type: 'text', text: 'Look' }, { type: 'image_url' }] },
    { role: 'assistant', content: 'Nice.' },
    { role: 'user', content: 'And now?' },
  ]);
  assert.equal(system, 'Persona.\n\nRules.');
  assert.match(prompt, /User: Look\[image_url omitted\]\n\nAssistant: Nice\./);
  assert(prompt.endsWith('And now?'));
  assert.throws(() => promptFromMessages([]), /required/);
  assert.throws(() => promptFromMessages([{ role: 'assistant', content: 'x' }]), /last message/);
  assert.throws(() => promptFromMessages([{ role: 'root', content: 'x' }]), /role/);
});

test('streamed text deltas are forwarded and the prompt goes over stdin', async () => {
  const fake = fakeClaude([
    { type: 'system', subtype: 'init' },
    delta('Hey '),
    delta('there!'),
    success,
  ]);
  const seen = [];
  const result = await runClaude({
    claude: '/bin/claude',
    prompt: 'Hello',
    onText: (text) => seen.push(text),
    spawnProcess: fake.spawnProcess,
  });
  assert.deepEqual(seen, ['Hey ', 'there!']);
  assert.equal(result.text, 'Hey there!');
  assert.equal(fake.calls[0].input, 'Hello');
});

test('a CLI error result or a crash is reported, and abort kills the process', async () => {
  await assert.rejects(
    runClaude({
      claude: 'c',
      prompt: 'x',
      spawnProcess: fakeClaude([{ type: 'result', is_error: true, result: 'Not logged in' }], {
        code: 1,
      }).spawnProcess,
    }),
    { status: 502, message: /Not logged in/ },
  );
  const held = fakeClaude([], { hold: true });
  const controller = new AbortController();
  const running = runClaude({
    claude: 'c',
    prompt: 'x',
    signal: controller.signal,
    spawnProcess: held.spawnProcess,
  });
  await new Promise((resolve) => setImmediate(resolve));
  controller.abort(new Error('stop'));
  await assert.rejects(running, /stop/);
  assert.equal(held.calls[0].child.killed, 'SIGTERM');
});

async function withBridge(options, task) {
  const bridge = createClaudeCodeBridge({
    claude: '/bin/claude',
    token: 't'.repeat(32),
    ...options,
  });
  await new Promise((resolve) => bridge.server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${bridge.server.address().port}/v1`;
  try {
    await task(base, { authorization: 'Bearer ' + 't'.repeat(32) });
  } finally {
    bridge.server.close();
  }
}

test('browser and rebinding requests are refused even without a token', async () => {
  await withBridge({ token: null, run: () => assert.fail('must not run') }, async (base) => {
    const port = new URL(base).port;
    const ok = await fetch(base + '/models');
    assert.equal(ok.status, 200);
    // Node fetch cannot forge Host/Origin, so check the guard directly.
    assert.equal(browserRequest({ host: `127.0.0.1:${port}` }, port), false);
    assert.equal(browserRequest({ host: `localhost:${port}` }, port), false);
    for (const headers of [
      { host: `127.0.0.1:${port}`, origin: 'https://evil.example' },
      { host: `127.0.0.1:${port}`, 'sec-fetch-site': 'cross-site' },
      { host: `evil.example:${port}` },
      {},
    ])
      assert.equal(browserRequest(headers, port), true, JSON.stringify(headers));
    const form = await fetch(base + '/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'x' }] }),
    });
    assert.equal(form.status, 415);
  });
});

test('with a token configured every request needs it, including the model list', async () => {
  await withBridge({ run: () => assert.fail('must not run') }, async (base, auth) => {
    for (const headers of [{}, { authorization: 'Bearer wrong' }]) {
      const response = await fetch(base + '/models', { headers });
      assert.equal(response.status, 401);
    }
    const models = await (await fetch(base + '/models', { headers: auth })).json();
    assert(models.data.some(({ id }) => id === 'claude-code-haiku'));
  });
});

test('the bridge answers OpenAI streaming and non-streaming requests', async () => {
  const runs = [];
  const run = async (options) => {
    runs.push(options);
    options.onText?.('Hi');
    options.onText?.('!');
    return { text: 'Hi!', usage: success.usage };
  };
  await withBridge(
    { run, env: { PATH: '/usr/bin', NODE_OPTIONS: '--x', CAPRI_SECRET: 's' } },
    async (base, auth) => {
      const post = (body) =>
        fetch(base + '/chat/completions', {
          method: 'POST',
          headers: { ...auth, 'content-type': 'application/json' },
          body: JSON.stringify(body),
        });
      const messages = [{ role: 'user', content: 'Hello' }];
      const plain = await (await post({ model: 'claude-code-haiku', messages })).json();
      assert.equal(plain.choices[0].message.content, 'Hi!');
      assert.equal(plain.usage.completion_tokens, 3);
      assert.equal(runs[0].model, 'haiku');
      assert.equal(runs[0].env.NODE_OPTIONS, undefined);
      assert.equal(runs[0].env.CAPRI_SECRET, undefined);
      assert.equal(runs[0].env.PATH, '/usr/bin');

      const streamed = await (
        await post({
          model: 'claude-code',
          messages,
          stream: true,
          stream_options: { include_usage: true },
        })
      ).text();
      const events = streamed
        .split('\n\n')
        .filter((line) => line.startsWith('data: ') && !line.includes('[DONE]'))
        .map((line) => JSON.parse(line.slice(6)));
      assert.equal(events.map((e) => e.choices[0].delta.content ?? '').join(''), 'Hi!');
      assert.equal(events.at(-1).choices[0].finish_reason, 'stop');
      assert.equal(events.at(-1).usage.total_tokens, 15);
      assert(streamed.trim().endsWith('data: [DONE]'));
      assert.equal(runs[1].model, null);

      assert.equal((await post({ model: 'gpt-4', messages })).status, 400);
    },
  );
});

test('concurrent requests beyond the limit are refused instead of queued', async () => {
  let release;
  const gate = new Promise((resolve) => (release = resolve));
  await withBridge(
    { maxConcurrent: 1, run: async () => (await gate, { text: 'ok' }) },
    async (base, auth) => {
      const post = () =>
        fetch(base + '/chat/completions', {
          method: 'POST',
          headers: { ...auth, 'content-type': 'application/json' },
          body: JSON.stringify({ messages: [{ role: 'user', content: 'x' }] }),
        });
      const first = post();
      await new Promise((resolve) => setTimeout(resolve, 50));
      assert.equal((await post()).status, 429);
      release();
      assert.equal((await first).status, 200);
    },
  );
});

test('memory search is suspended without local memory and restored only by Capri', async () => {
  const { mkdtempSync, existsSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const path = (await import('node:path')).default;
  const { applyMemoryAvailability } = await import('../packages/runtime/src/context.mjs');
  const marker = path.join(mkdtempSync(path.join(tmpdir(), 'capri-memory-')), 'suspended.json');
  const config = { memory: { search: { enabled: true } } };
  applyMemoryAvailability(config, { localMemory: false }, marker);
  assert.equal(config.memory.search.enabled, false);
  assert.equal(existsSync(marker), true);
  applyMemoryAvailability(config, {}, marker);
  assert.equal(config.memory.search.enabled, false, 'unknown availability changes nothing');
  applyMemoryAvailability(config, { localMemory: true }, marker);
  assert.equal(config.memory.search.enabled, true);
  assert.equal(existsSync(marker), false);
  const owner = { memory: { search: { enabled: false } } };
  applyMemoryAvailability(owner, { localMemory: true }, marker);
  assert.equal(owner.memory.search.enabled, false, "the owner's own choice is kept");
});
