// SPDX-License-Identifier: GPL-3.0-only
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { root } from '../packages/runtime/src/host/paths.mjs';
import { writeJsonAtomic } from '../packages/runtime/src/atomic-json.mjs';
import { configureSpotify, spotifyAccess } from '../integrations/spotify/configuration.mjs';
import { SpotifySettings } from '../apps/desktop/spotify-settings.mjs';

function fixture() {
  const parent = path.join(root, '.runtime/test-data');
  mkdirSync(parent, { recursive: true });
  const folder = mkdtempSync(path.join(parent, 'spotify-settings-'));
  const config = {
    tools: { allow: ['memory_search'], deny: ['exec', 'spotify_control'] },
    agents: {
      defaults: { thinkingDefault: 'low', model: { primary: 'ollama/capri-qwen3.5:9b' } },
      entries: { capri: { tools: { allow: ['memory_search'], deny: ['shell'] } } },
    },
    plugins: { allow: ['other'], entries: { other: { enabled: true } }, load: { paths: [] } },
  };
  const rt = {
    configPath: path.join(folder, 'private/config.json'),
  };
  writeJsonAtomic(rt.configPath, config);
  // Linux has no Spotify helper to build yet (MPRIS needs none).
  const prepare = () => {};
  return { root: folder, rt, agentId: 'capri', node: process.execPath, config, prepare };
}
test('Spotify permission changes preserve other tools, model, plugins and reasoning', () => {
  const f = fixture(),
    on = configureSpotify(f.config, { ...f, enabled: true });
  assert.equal(spotifyAccess(on, f.root, f.agentId), true);
  assert.deepEqual(on.agents.defaults, f.config.agents.defaults);
  assert.deepEqual(on.plugins.entries.other, f.config.plugins.entries.other);
  assert.deepEqual(on.tools.deny, ['exec']);
  assert.deepEqual(on.agents.entries.capri.tools.deny, ['shell']);
  assert.equal(f.config.plugins.entries['capri-spotify'], undefined);
  const off = configureSpotify(on, { ...f, enabled: false });
  assert.equal(spotifyAccess(off, f.root, f.agentId), false);
  assert.deepEqual(off.tools.allow, ['memory_search']);
  assert.deepEqual(off.plugins.allow, ['other']);
  assert.deepEqual(off.plugins.load.paths, []);
  assert.equal(spotifyAccess({ ...on, agents: {} }, f.root, f.agentId), false);
  on.agents.entries.capri.tools.deny.push('spotify_control');
  assert.equal(spotifyAccess(on, f.root, f.agentId), false);
});
test('a failed native build cannot grant Spotify access or stop the running core', async () => {
  const f = fixture();
  const settings = new SpotifySettings({
    ...f,
    execute: async (_node, args, options) => {
      assert.equal(args[0], path.join(f.root, 'integrations/spotify/provision.mjs'));
      assert.equal(options.env.CAPRI_NODE_PATH, process.execPath);
      assert.equal(options.env.OPENCLAW_GATEWAY_TOKEN, undefined);
      assert.equal(options.windowsHide, true);
      throw new Error('compiler fixture');
    },
  });
  assert.equal(settings.snapshot().enabled, false);
  await assert.rejects(
    settings.setEnabled(true, {
      beforeCommit: () => assert.fail('Cannot stop core before compiling'),
      restart: () => assert.fail('Cannot restart after failed compile'),
    }),
    /compiler fixture/,
  );
  assert.deepEqual(JSON.parse(readFileSync(f.rt.configPath)), f.config);
  assert.equal(settings.busy(), false);
});

test('without a Linux Spotify bridge, enabling and checking fail without changing permissions', async () => {
  const f = fixture();
  const settings = new SpotifySettings({ ...f, execute: async () => {} });
  assert.equal(settings.snapshot().prepared, false);
  await assert.rejects(
    settings.setEnabled(true, {
      beforeCommit: () => assert.fail('Nothing may stop the core without a bridge'),
      restart: () => assert.fail('Nothing may restart without a bridge'),
    }),
    /could not be verified/,
  );
  assert.deepEqual(JSON.parse(readFileSync(f.rt.configPath)), f.config);
  await assert.rejects(settings.check(), /Enable Spotify control first/);
  assert.equal(settings.busy(), false);
});
