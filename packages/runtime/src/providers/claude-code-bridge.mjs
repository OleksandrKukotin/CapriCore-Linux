// SPDX-License-Identifier: GPL-3.0-only
/**
 * OpenAI-compatible Chat Completions endpoint on loopback that answers with the
 * signed-in Claude Code CLI (`claude -p`). Capri uses it as a Custom API
 * connection, so text chat works without a local model download.
 *
 * Claude runs with no built-in tools, no MCP servers and no settings files, in
 * an empty working folder: it can only write text. Capri's own tool calls are
 * not forwarded (text-only).
 */
import { spawn } from 'node:child_process';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import http from 'node:http';
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

/** Model IDs Capri can pick; the value is the CLI `--model` alias (null = account default). */
export const CLAUDE_CODE_MODELS = Object.freeze({
  'claude-code': null,
  'claude-code-haiku': 'haiku',
  'claude-code-sonnet': 'sonnet',
  'claude-code-opus': 'opus',
});
const MAX_BODY = 4 * 1024 ** 2;
const MAX_PROMPT = 1024 ** 2;

const textOf = (content) => {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .map((part) =>
      part?.type === 'text' ? String(part.text ?? '') : part?.type ? `[${part.type} omitted]` : '',
    )
    .join('');
};

/**
 * Turn Chat Completions messages into one system prompt and one prompt. The CLI
 * takes no prior assistant turns, so earlier turns become a labelled transcript.
 */
export function promptFromMessages(messages) {
  if (!Array.isArray(messages) || !messages.length) throw requestError('messages are required.');
  const system = [],
    turns = [];
  for (const message of messages) {
    const text = textOf(message?.content).trim();
    if (['system', 'developer'].includes(message?.role)) {
      if (text) system.push(text);
    } else if (['user', 'assistant', 'tool'].includes(message?.role)) {
      if (text) turns.push({ role: message.role, text });
    } else throw requestError('Unsupported message role.');
  }
  const last = turns.at(-1);
  if (!last || last.role !== 'user')
    throw requestError('The last message must come from the user.');
  const label = { user: 'User', assistant: 'Assistant', tool: 'Tool result' };
  const prompt =
    turns.length === 1
      ? last.text
      : 'Conversation so far:\n\n' +
        turns
          .slice(0, -1)
          .map((turn) => `${label[turn.role]}: ${turn.text}`)
          .join('\n\n') +
        `\n\nReply to the user's latest message, in character:\n\n${last.text}`;
  if (prompt.length > MAX_PROMPT) throw requestError('The conversation is too long.');
  return { system: system.join('\n\n'), prompt };
}

function requestError(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

export function claudeArguments({ model, system }) {
  const args = [
    '-p',
    '--output-format',
    'stream-json',
    '--verbose',
    '--include-partial-messages',
    '--tools',
    '',
    '--strict-mcp-config',
    '--setting-sources',
    '',
    '--no-session-persistence',
  ];
  if (model) args.push('--model', model);
  if (system) args.push('--system-prompt', system);
  return args;
}

/**
 * Run one completion. Calls `onText` for each streamed text delta and resolves
 * with the full text and usage. Rejects when the CLI fails or `signal` aborts.
 */
export function runClaude({
  claude,
  model,
  system,
  prompt,
  signal,
  onText = () => {},
  spawnProcess = spawn,
  cwd,
  env,
  timeoutMs = 5 * 60 * 1000,
}) {
  return new Promise((resolve, reject) => {
    const child = spawnProcess(claude, claudeArguments({ model, system }), {
      cwd,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let buffer = '',
      text = '',
      result = null,
      stderr = '',
      settled = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      if (error) reject(error);
      else resolve(value);
    };
    const kill = () => {
      if (child.exitCode === null) child.kill('SIGTERM');
    };
    // Settle before killing: the close event must not replace the real reason.
    const abort = () => {
      finish(signal.reason ?? new Error('Cancelled'));
      kill();
    };
    const timer = setTimeout(() => {
      finish(requestError('Claude Code did not answer in time.', 504));
      kill();
    }, timeoutMs);
    const handle = (line) => {
      let event;
      try {
        event = JSON.parse(line);
      } catch {
        return;
      }
      if (event.type === 'stream_event') {
        const delta = event.event;
        if (delta?.type === 'content_block_delta' && delta.delta?.type === 'text_delta') {
          text += delta.delta.text;
          onText(delta.delta.text);
        }
      } else if (event.type === 'result') result = event;
    };
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      buffer += chunk;
      let at;
      while ((at = buffer.indexOf('\n')) >= 0) {
        handle(buffer.slice(0, at));
        buffer = buffer.slice(at + 1);
      }
    });
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => {
      stderr = (stderr + chunk).slice(-2000);
    });
    child.once('error', (error) =>
      finish(requestError(`Claude Code could not start: ${error.message}`, 502)),
    );
    child.once('close', (code) => {
      if (buffer) handle(buffer);
      if (result && !result.is_error)
        return finish(null, { text: text || String(result.result ?? ''), usage: result.usage });
      const reason = result?.is_error
        ? String(result.result ?? result.subtype ?? 'error')
        : stderr.trim() || `exit ${code}`;
      finish(requestError(`Claude Code failed: ${reason.slice(0, 500)}`, 502));
    });
    signal?.addEventListener('abort', abort, { once: true });
    child.stdin.end(prompt);
  });
}

/**
 * Browser pages can send requests to loopback. Browsers always mark them with
 * Origin or Sec-Fetch-Site, a rebinding attack shows its own Host name, and a
 * JSON POST from a page needs a CORS preflight that is never approved. Capri's
 * main process (Node fetch) sends none of these.
 */
export function browserRequest(headers, port) {
  if (headers.origin !== undefined || headers['sec-fetch-site'] !== undefined) return true;
  if (![`127.0.0.1:${port}`, `localhost:${port}`].includes(headers.host)) return true;
  return false;
}

const tokenMatches = (header, token) => {
  const given = Buffer.from(/^Bearer (.+)$/.exec(header ?? '')?.[1] ?? '');
  const expected = Buffer.from(token);
  return given.length === expected.length && timingSafeEqual(given, expected);
};

const usageOf = (usage) => {
  if (!usage) return undefined;
  const prompt =
    (usage.input_tokens ?? 0) +
    (usage.cache_read_input_tokens ?? 0) +
    (usage.cache_creation_input_tokens ?? 0);
  const completion = usage.output_tokens ?? 0;
  return {
    prompt_tokens: prompt,
    completion_tokens: completion,
    total_tokens: prompt + completion,
  };
};

/**
 * Create the bridge server. Browser requests are always refused so web pages
 * cannot spend the owner's Claude usage. A bearer token is optional: Capri saves
 * loopback connections without a key, which avoids the system keyring.
 */
export function createClaudeCodeBridge({
  claude,
  token = null,
  maxConcurrent = 2,
  run = runClaude,
  workDir = path.join(tmpdir(), 'capri-claude-bridge'),
  env = process.env,
} = {}) {
  if (!claude) throw new Error('The Claude Code CLI was not found.');
  mkdirSync(workDir, { recursive: true, mode: 0o700 });
  // The CLI keeps its own sign-in; Capri's secrets and Node options stay out.
  const childEnv = Object.fromEntries(
    Object.entries(env).filter(
      ([key]) => !/^(NODE_OPTIONS|NODE_PATH|ELECTRON_|CAPRI_|ANTHROPIC_API_KEY$)/.test(key),
    ),
  );
  let active = 0;
  const send = (response, status, body) => {
    response.writeHead(status, { 'content-type': 'application/json' });
    response.end(JSON.stringify(body));
  };
  const fail = (response, status, message) =>
    send(response, status, { error: { message, type: status === 401 ? 'auth' : 'request' } });

  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    if (browserRequest(request.headers, server.address()?.port))
      return fail(response, 403, 'Browser requests are not accepted.');
    if (token && !tokenMatches(request.headers.authorization, token))
      return fail(response, 401, 'A valid bridge token is required.');
    if (request.method === 'GET' && url.pathname === '/v1/models')
      return send(response, 200, {
        object: 'list',
        data: Object.keys(CLAUDE_CODE_MODELS).map((id) => ({
          id,
          object: 'model',
          owned_by: 'claude-code',
        })),
      });
    if (request.method !== 'POST' || url.pathname !== '/v1/chat/completions')
      return fail(response, 404, 'Not found.');
    if (!/^application\/json\b/i.test(request.headers['content-type'] ?? ''))
      return fail(response, 415, 'Send JSON.');
    let raw = '';
    try {
      for await (const chunk of request) {
        raw += chunk;
        if (raw.length > MAX_BODY) throw requestError('The request is too large.', 413);
      }
    } catch (error) {
      return fail(response, error.status ?? 400, error.message);
    }
    let body, prompt;
    try {
      body = JSON.parse(raw);
      if (!Object.hasOwn(CLAUDE_CODE_MODELS, body.model ?? 'claude-code'))
        throw requestError(
          `Unknown model. Use one of: ${Object.keys(CLAUDE_CODE_MODELS).join(', ')}.`,
        );
      prompt = promptFromMessages(body.messages);
    } catch (error) {
      return fail(response, error.status ?? 400, error.message);
    }
    if (active >= maxConcurrent) return fail(response, 429, 'Claude Code is busy. Retry shortly.');
    active++;
    const controller = new AbortController();
    response.once('close', () => {
      if (!response.writableFinished) controller.abort(new Error('Client disconnected'));
    });
    const id = `chatcmpl-${randomBytes(9).toString('hex')}`;
    const created = Math.floor(Date.now() / 1000);
    const model = body.model ?? 'claude-code';
    const chunk = (delta, finish = null, extra = {}) =>
      `data: ${JSON.stringify({
        id,
        object: 'chat.completion.chunk',
        created,
        model,
        choices: [{ index: 0, delta, finish_reason: finish }],
        ...extra,
      })}\n\n`;
    const stream = body.stream === true;
    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      response.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
      });
      response.write(chunk({ role: 'assistant', content: '' }));
    };
    try {
      const result = await run({
        claude,
        model: CLAUDE_CODE_MODELS[model],
        ...prompt,
        signal: controller.signal,
        cwd: workDir,
        env: childEnv,
        onText: stream
          ? (text) => {
              start();
              response.write(chunk({ content: text }));
            }
          : undefined,
      });
      const usage = usageOf(result.usage);
      if (stream) {
        start();
        response.write(
          chunk({}, 'stop', body.stream_options?.include_usage && usage ? { usage } : {}),
        );
        response.end('data: [DONE]\n\n');
      } else
        send(response, 200, {
          id,
          object: 'chat.completion',
          created,
          model,
          choices: [
            {
              index: 0,
              message: { role: 'assistant', content: result.text },
              finish_reason: 'stop',
            },
          ],
          ...(usage ? { usage } : {}),
        });
    } catch (error) {
      if (controller.signal.aborted) response.destroy();
      else if (started) {
        response.write(`data: ${JSON.stringify({ error: { message: error.message } })}\n\n`);
        response.end('data: [DONE]\n\n');
      } else fail(response, error.status ?? 502, error.message);
    } finally {
      active--;
    }
  });
  return { server, token };
}
