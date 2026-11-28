// SPDX-License-Identifier: GPL-3.0-only
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { root } from '../packages/runtime/src/host/paths.mjs';
import { personaPrompt } from '../packages/runtime/src/context.mjs';
import {
  readCommunicationStyle,
  saveCommunicationStyle,
  COMMUNICATION_STYLES,
} from '../packages/runtime/src/communication.mjs';
import {
  savePersonality,
  initializePersonality,
  defaultPersonality,
} from '../packages/runtime/src/personality.mjs';
import { REPOSITORY } from '../packages/updater/src/releases.mjs';
import { listReleases } from '../packages/updater/src/github.mjs';
import { visuallySleeping } from '../apps/desktop/sleep-service.mjs';
import { PresenceModel } from '../apps/desktop/renderer/presence-model.mjs';

const parent = path.join(root, '.runtime/v036-unit');
mkdirSync(parent, { recursive: true });
const folder = () => mkdtempSync(path.join(parent, 'fixture-'));
test('each saved communication style reaches the next shared persona without rewriting the custom character', () => {
  const workspace = folder();
  savePersonality(workspace, 'My custom character stays editable.');
  assert.equal(readCommunicationStyle(workspace), 'neutral');
  for (const style of Object.keys(COMMUNICATION_STYLES)) {
    saveCommunicationStyle(workspace, style);
    const prompt = personaPrompt({ workspace });
    assert.ok(prompt.includes('COMMUNICATION STYLE: ' + style));
    assert.ok(prompt.includes('one or two short sentences'));
    assert.ok(prompt.includes('My custom character stays editable.'));
    assert.equal(
      readFileSync(path.join(workspace, 'PERSONALITY.md'), 'utf8'),
      'My custom character stays editable.',
    );
  }
  assert.throws(() => saveCommunicationStyle(workspace, 'invented instructions'));
});
test('desktop prompt previews use unsaved text and style without touching the workspace', () => {
  const workspace = folder();
  savePersonality(workspace, 'Saved personality.');
  saveCommunicationStyle(workspace, 'business');
  const preview = personaPrompt(
    { workspace },
    { personality: 'Preview personality.', style: 'wild' },
  );
  assert.match(preview, /Preview personality\./);
  assert.match(preview, /COMMUNICATION STYLE: wild/);
  const persisted = personaPrompt({ workspace });
  assert.match(persisted, /Saved personality\./);
  assert.match(persisted, /COMMUNICATION STYLE: business/);
});
test('only a reviewed stock personality is refreshed and its previous file is backed up', () => {
  const workspace = folder(),
    backupDirectory = folder(),
    old = 'An older stock default.';
  const digest = createHash('sha256').update(old).digest('hex');
  writeFileSync(path.join(workspace, 'PERSONALITY.md'), old);
  const result = initializePersonality(workspace, { backupDirectory, previousDefaults: [digest] });
  assert.equal(readFileSync(path.join(result.backup, 'PERSONALITY.md'), 'utf8'), old);
  assert.equal(readFileSync(path.join(workspace, 'PERSONALITY.md'), 'utf8'), defaultPersonality());
  savePersonality(workspace, 'Keep this custom character.');
  initializePersonality(workspace, { backupDirectory, previousDefaults: [digest] });
  assert.equal(
    readFileSync(path.join(workspace, 'PERSONALITY.md'), 'utf8'),
    'Keep this custom character.',
  );
});
test('disconnect uses resting artwork without reporting that models were unloaded', () => {
  for (const phase of ['offline', 'stopping']) {
    assert.equal(visuallySleeping('awake', phase), true);
    const presence = new PresenceModel();
    presence.phase = phase;
    presence.setSleeping(true);
    assert.equal(presence.snapshot().state, phase);
    assert.equal(presence.snapshot().expanded, true);
  }
  assert.equal(visuallySleeping('awake', 'ready'), false);
  assert.equal(visuallySleeping('awake', 'starting'), true);
  assert.equal(visuallySleeping('asleep', 'ready'), true);
});
test('public release failures are distinguished from GitHub rate limits and never quote response bodies', async () => {
  for (const [status, headers, expected] of [
    [404, {}, /public OleksandrKukotin\/CapriCore-Linux releases/],
    [403, { 'x-ratelimit-remaining': '4999' }, /Public Capri updates do not require a token/],
    [403, { 'x-ratelimit-remaining': '0' }, /limited/],
    [429, {}, /limited/],
  ]) {
    await assert.rejects(
      listReleases({
        fetchImpl: async () => new Response('untrusted response body', { status, headers }),
      }),
      expected,
    );
  }
});

test('strict GitHub access verification rejects invalid tokens and inaccessible repositories', async () => {
  for (const [status, token, pattern, reason] of [
    [401, 'github_pat_' + 'a'.repeat(30), /expired, revoked/, 'token_rejected'],
    [
      404,
      'github_pat_' + 'a'.repeat(30),
      /public OleksandrKukotin\/CapriCore-Linux releases/,
      'repository_not_visible',
    ],
    [
      404,
      'ghp_' + 'a'.repeat(30),
      /public OleksandrKukotin\/CapriCore-Linux releases/,
      'repository_not_visible',
    ],
  ]) {
    await assert.rejects(
      listReleases({ token, fetchImpl: async () => new Response(token, { status }) }),
      (error) => {
        assert.match(error.message, pattern);
        assert.equal(error.accessReason, reason);
        assert(!JSON.stringify(error).includes(token));
        assert(!error.message.includes(token));
        return true;
      },
    );
  }
});
