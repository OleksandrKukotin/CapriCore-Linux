// SPDX-License-Identifier: GPL-3.0-only
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import configured from '../config/community.json' with { type: 'json' };
import { COMMUNITY_LINKS, loadCommunityLinks } from '../apps/desktop/community-links.mjs';
import { DiscordPresence } from '../apps/desktop/discord-presence.mjs';
import {
  COMMUNITY_LINKS as legacyLinks,
  registerCompanionIpc,
} from '../apps/desktop/main/companion-ipc.mjs';

const PROJECT = 'https://github.com/OleksandrKukotin/CapriCore-Linux';
const parent = path.join(process.cwd(), '.runtime/community-links-tests');
mkdirSync(parent, { recursive: true });
function fixture(value) {
  const root = mkdtempSync(path.join(parent, 'case-'));
  mkdirSync(path.join(root, 'config'));
  if (value !== undefined)
    writeFileSync(path.join(root, 'config/community.json'), JSON.stringify(value));
  return root;
}
const activity = (links) =>
  new DiscordPresence({
    preferences: {
      snapshot: () => ({ enabled: true, applicationId: '123456789012345678', assetKey: '' }),
    },
    communityLinks: links,
  }).activity();

test('the only community destinations are this project on GitHub', () => {
  assert.equal(legacyLinks, COMMUNITY_LINKS, 'Existing imports retain the same allowlist');
  assert.deepEqual(configured, COMMUNITY_LINKS);
  assert.deepEqual(COMMUNITY_LINKS, {
    github: PROJECT,
    releases: PROJECT + '/releases/latest',
    issues: PROJECT + '/issues/new/choose',
    'issue-list': PROJECT + '/issues',
  });
  assert.deepEqual(activity().buttons, [{ label: 'Get Capri', url: PROJECT }]);
});

test('a moved project updates presence and Settings together without forwarding unknown keys', async () => {
  const moved = 'https://github.com/example/CapriCore-Linux';
  const root = fixture({ github: moved, futurePrivateMetadata: 'fixture-private-value' });
  const links = loadCommunityLinks(root);
  assert.deepEqual(Object.keys(links), Object.keys(COMMUNITY_LINKS));
  assert(Object.isFrozen(links));
  assert.equal(links.github, moved);
  assert.equal(links.releases, COMMUNITY_LINKS.releases, 'Partial configs keep the other links');
  const presence = activity(links);
  assert.equal(presence.buttons[0].url, moved);
  assert(!JSON.stringify(presence).includes('fixture-private-value'));
  const handlers = new Map(),
    opened = [];
  registerCompanionIpc((name, handler) => handlers.set(name, handler), {
    root,
    state: root,
    rt: { workspace: root },
    preferences: {},
    shell: { openExternal: async (url) => opened.push(url) },
  });
  const open = handlers.get('capri:community-link');
  for (const id of ['github', 'issues', 'releases']) await open(id);
  assert.deepEqual(opened, [moved, COMMUNITY_LINKS.issues, COMMUNITY_LINKS.releases]);
  // Removed upstream destinations, prototype keys and URLs are not identifiers.
  for (const id of [
    'boosty',
    'lava-donate',
    'discord',
    'website',
    'futurePrivateMetadata',
    '__proto__',
    'constructor',
    'file:///private',
  ])
    await assert.rejects(open(id), /Unknown community link/);
  assert.equal(opened.length, 3);
  assert.equal(handlers.has('capri:donation-open'), false);
  assert.equal(handlers.has('capri:bug-report-send'), false);
});

test('malformed files and destinations outside GitHub over HTTPS use safe defaults', () => {
  assert.equal(loadCommunityLinks(fixture()), COMMUNITY_LINKS);
  for (const value of [
    null,
    [],
    'not-a-map',
    { github: null },
    { github: 'http://github.com/example/CapriCore-Linux' },
    { github: 'https://user:password@github.com/example/CapriCore-Linux' },
    { github: 'https://github.com:8443/example/CapriCore-Linux' },
    { github: 'https://github.com.evil.invalid/Capri' },
    { issues: 'https://boosty.to/overyx' },
    { releases: 'file:///private' },
  ])
    assert.equal(loadCommunityLinks(fixture(value)), COMMUNITY_LINKS);
  const broken = fixture();
  writeFileSync(path.join(broken, 'config/community.json'), '{broken');
  assert.equal(loadCommunityLinks(broken), COMMUNITY_LINKS);
});
