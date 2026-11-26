#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-only
/**
 * Serve Claude Code as a local OpenAI-compatible API for Capri's text chat.
 *
 *   npm run claude-bridge [-- --port 18793]
 *
 * Then in Capri: Settings → API connections → Add → Custom, with the printed
 * base URL, a blank key and a model such as claude-code-haiku. Browser
 * requests are refused; pass --require-token to also demand a key.
 */
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { findExecutable, paths } from '../src/host/paths.mjs';
import { writePrivateBytesAtomic } from '../src/safe-file.mjs';
import { createClaudeCodeBridge } from '../src/providers/claude-code-bridge.mjs';

const { values } = parseArgs({
  options: {
    port: { type: 'string', default: '18793' },
    // Capri saves loopback connections without a key; a key would need the system keyring.
    'require-token': { type: 'boolean', default: false },
  },
});
const port = Number(values.port);
if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  console.error('Choose a port between 1024 and 65535.');
  process.exit(2);
}
const claude =
  process.env.CAPRI_CLAUDE_PATH ||
  findExecutable('claude', {
    extra: [process.env.HOME && path.join(process.env.HOME, '.local/bin/claude')],
  });
if (!claude) {
  console.error(
    'Claude Code is not installed or not on PATH. Install it and sign in with `claude`.',
  );
  process.exit(1);
}

// Optional: a stable token keeps a saved keyed connection valid across restarts.
let token = null;
if (values['require-token']) {
  const tokenFile = path.join(paths.data, 'secrets/claude-bridge.json');
  try {
    token = JSON.parse(readFileSync(tokenFile, 'utf8')).token;
  } catch {}
  if (typeof token !== 'string' || token.length < 32) {
    token = randomBytes(24).toString('base64url');
    writePrivateBytesAtomic(tokenFile, Buffer.from(JSON.stringify({ token }) + '\n'));
  }
}
const { server } = createClaudeCodeBridge({ claude, token });
server.listen(port, '127.0.0.1', () => {
  console.log(`Claude Code bridge for Capri
  Base URL: http://127.0.0.1:${port}/v1
  API key:  ${token ?? '(leave blank)'}
  Models:   claude-code-haiku (fastest), claude-code-sonnet, claude-code-opus, claude-code (account default)
Text only: Claude runs without tools. Press Ctrl+C to stop.`);
});
server.on('error', (error) => {
  console.error(
    error.code === 'EADDRINUSE' ? `Port ${port} is in use; pass --port.` : error.message,
  );
  process.exit(1);
});
for (const signal of ['SIGINT', 'SIGTERM'])
  process.once(signal, () => server.close(() => process.exit(0)));
