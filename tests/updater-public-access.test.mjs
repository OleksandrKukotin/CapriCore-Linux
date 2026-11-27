// SPDX-License-Identifier: GPL-3.0-only
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { root } from '../packages/runtime/src/host/paths.mjs';
import { githubFetch, listReleases, listUpdateReleases } from '../packages/updater/src/github.mjs';
import { REPOSITORY } from '../packages/updater/src/releases.mjs';
import { downloadUpdate } from '../packages/updater/src/download.mjs';
import { UpdateService } from '../apps/desktop/update-service.mjs';

const api = `https://api.github.com/repos/${REPOSITORY}/releases`;
const token = 'synthetic-optional-credential';
const parent = path.join(root, '.runtime/public-update-unit');
mkdirSync(parent, { recursive: true });
const folder = () => mkdtempSync(path.join(parent, 'case-'));
const bytes = Buffer.from('synthetic public release artifact');
const asset = {
  id: 42,
  name: 'CapriSetup-1.1.0.exe',
  bytes: bytes.length,
  sha256: createHash('sha256').update(bytes).digest('hex'),
};
const release = {
  tag_name: 'v1.1.0',
  draft: false,
  prerelease: false,
  assets: [
    {
      id: asset.id,
      name: asset.name,
      size: asset.bytes,
      digest: 'sha256:' + asset.sha256,
      state: 'uploaded',
    },
  ],
};

test('releases come only from this project on GitHub, with no mirror or private repository', async () => {
  assert.equal(REPOSITORY, 'OleksandrKukotin/CapriCore-Linux');
  const fetches = [];
  const items = await listUpdateReleases({
    token,
    fetchImpl: async (url) => {
      fetches.push(url.href);
      return Response.json([release]);
    },
  });
  assert.deepEqual(items, [release]);
  assert.deepEqual(fetches, [api + '?per_page=100&page=1']);
  for (const repository of ['CapriChooms/CapriCore', 'CapriChooms/Capri'])
    await assert.rejects(
      listUpdateReleases({ repository, fetchImpl: async () => Response.json([]) }),
      /Unapproved update repository/,
    );
  // An unavailable feed is reported; nothing falls back to another host.
  const hosts = [];
  await assert.rejects(
    listUpdateReleases({
      fetchImpl: async (url) => {
        hosts.push(url.origin);
        return new Response(null, { status: 404 });
      },
    }),
    { code: 'GITHUB_RELEASES_UNAVAILABLE' },
  );
  assert.deepEqual(hosts, ['https://api.github.com']);
});

test('release history exposes notes, separates older versions and shows pre-releases on request', async () => {
  const base = folder();
  mkdirSync(path.join(base, 'config'), { recursive: true });
  writeFileSync(path.join(base, 'config/release.json'), '{"tag":"v1.0.0"}');
  const calls = [];
  const service = new UpdateService({
    root: base,
    state: base,
    credential: async () => null,
    releases: async (options) => {
      calls.push(options.repository ?? REPOSITORY);
      return [
        { ...release, body: 'Public changelog' },
        { ...release, tag_name: 'v0.9.0', assets: [] },
        { ...release, tag_name: 'v1.2.0-rc.1', prerelease: true },
      ];
    },
  });
  const stable = await service.history(false);
  assert.deepEqual(
    stable.releases.map(({ tag }) => tag),
    ['v1.1.0', 'v0.9.0'],
  );
  const [newer, older] = stable.releases;
  assert.equal(newer.notes, 'Public changelog');
  assert.equal(older.update, false);
  await assert.rejects(service.chooseHistory(older.id), /not available/);
  assert.equal((await service.chooseHistory(newer.id)).release.tag, 'v1.1.0');
  assert.equal(
    service.historyUrl(newer.id),
    `https://github.com/${REPOSITORY}/releases/tag/v1.1.0`,
  );
  const withPreviews = await service.history(true);
  const [preview] = withPreviews.releases;
  assert.equal(preview.tag, 'v1.2.0-rc.1');
  assert.equal(preview.experimental, true);
  assert.deepEqual(calls, [REPOSITORY, REPOSITORY]);
  await service.history(false);
  assert.throws(() => service.historyUrl(preview.id), /choose a version/);
});

test('a git checkout is offered newer tagged releases without an installer and never downloads', async () => {
  const base = folder();
  mkdirSync(path.join(base, 'config'), { recursive: true });
  mkdirSync(path.join(base, '.git'));
  writeFileSync(path.join(base, 'config/release.json'), '{"tag":"v1.2.2"}');
  const service = new UpdateService({
    root: base,
    state: base,
    credential: async () => null,
    releases: async () => [
      { ...release, tag_name: 'v1.2.3', assets: [] },
      { ...release, tag_name: 'v1.4.0-beta.1', prerelease: true, assets: [] },
      { ...release, tag_name: 'v1.2.1', assets: [] },
    ],
  });
  assert.equal(service.snapshot().mode, 'checkout');
  const stable = await service.check();
  assert.equal(stable.phase, 'available');
  assert.equal(stable.release.tag, 'v1.2.3');
  await assert.rejects(service.prepare(), { code: 'CAPRI_PLATFORM_UNAVAILABLE' });
  const history = await service.history(true);
  assert.deepEqual(
    history.releases.map(({ tag, update }) => [tag, update]),
    [
      ['v1.4.0-beta.1', true],
      ['v1.2.3', true],
      ['v1.2.1', false],
    ],
  );
  service.close();
});

test('public release metadata uses the fixed public repository without authorization', async () => {
  let requests = 0;
  const items = await listReleases({
    fetchImpl: async (url, options) => {
      requests++;
      assert.equal(url.pathname, `/repos/${REPOSITORY}/releases`);
      assert.equal(new Headers(options.headers).get('authorization'), null);
      assert.equal(options.redirect, 'manual');
      assert.equal(options.credentials, 'omit');
      return new Response(JSON.stringify([release]));
    },
  });
  assert.deepEqual(items, [release]);
  assert.equal(requests, 1);
});

test('optional access retries a rejected credential once anonymously on the same API URL', async (t) => {
  for (const status of [401, 403, 404]) {
    await t.test(String(status), async () => {
      const calls = [];
      const items = await listReleases({
        token,
        allowAnonymousFallback: true,
        fetchImpl: async (url, options) => {
          calls.push({
            url: url.href,
            authorization: new Headers(options.headers).get('authorization'),
          });
          return calls.length === 1
            ? new Response('untrusted failure body ' + token, { status })
            : new Response(JSON.stringify([release]));
        },
      });
      assert.deepEqual(items, [release]);
      assert.equal(calls.length, 2);
      assert.equal(calls[0].url, calls[1].url);
      assert.equal(calls[0].authorization, 'Bearer ' + token);
      assert.equal(calls[1].authorization, null);
    });
  }
});

test('strict token validation and rate-limit responses never retry anonymously', async (t) => {
  for (const [status, headers, allowAnonymousFallback] of [
    [401, {}, false],
    [403, { 'x-ratelimit-remaining': '0' }, true],
    [403, { 'retry-after': '60' }, true],
    [429, {}, true],
  ]) {
    await t.test(`${status} ${JSON.stringify(headers)}`, async () => {
      let requests = 0;
      await assert.rejects(
        listReleases({
          token,
          allowAnonymousFallback,
          fetchImpl: async () => {
            requests++;
            return new Response(token, { status, headers });
          },
        }),
        (error) => error.httpStatus === status && !error.message.includes(token),
      );
      assert.equal(requests, 1);
    });
  }
});

test('public downloads and stale credentials retain fixed URLs, SHA-256 and credential-free CDN redirects', async (t) => {
  for (const credential of [undefined, token]) {
    await t.test(credential ? 'rejected optional credential' : 'anonymous', async () => {
      const calls = [];
      const file = await downloadUpdate(asset, folder(), {
        token: credential,
        fetchImpl: async (url, options) => {
          const authorization = new Headers(options.headers).get('authorization');
          calls.push({ url: url.href, authorization });
          assert.equal(options.redirect, 'manual');
          assert.equal(options.credentials, 'omit');
          if (authorization) return new Response(null, { status: 401 });
          if (url.origin === 'https://api.github.com') {
            assert.equal(url.href, api + '/assets/' + asset.id);
            return new Response(null, {
              status: 302,
              headers: { location: 'https://release-assets.githubusercontent.com/public/file.zip' },
            });
          }
          assert.equal(url.hostname, 'release-assets.githubusercontent.com');
          return new Response(bytes);
        },
      });
      assert.deepEqual(readFileSync(file), bytes);
      assert.equal(calls.length, credential ? 3 : 2);
      assert.equal(calls.at(-1).authorization, null);
    });
  }
});

test('anonymous fallback never permits old repositories, arbitrary hosts, insecure redirects or bad hashes', async () => {
  let requests = 0;
  const request = githubFetch({
    token,
    allowAnonymousFallback: true,
    fetchImpl: async () => {
      requests++;
      return new Response('');
    },
  });
  for (const url of [
    'https://api.github.com/repos/CapriChooms/Capri/releases',
    'https://api.github.com/repos/attacker/repo/releases',
    'https://untrusted.example/file.zip',
    'http://release-assets.githubusercontent.com/file.zip',
    `https://api.github.com:444/repos/${REPOSITORY}/releases`,
  ])
    await assert.rejects(request(url), /Unapproved/);
  assert.equal(requests, 0);
  await assert.rejects(
    downloadUpdate(asset, folder(), {
      token,
      fetchImpl: async () =>
        new Response(null, {
          status: 302,
          headers: { location: 'https://untrusted.example/file.zip' },
        }),
    }),
    /Unapproved/,
  );
  await assert.rejects(
    downloadUpdate({ ...asset, sha256: '0'.repeat(64) }, folder(), {
      fetchImpl: async () => new Response(bytes),
    }),
    /checksum/,
  );
  let tlsRequests = 0;
  await assert.rejects(
    downloadUpdate(asset, folder(), {
      token,
      fetchImpl: async () => {
        tlsRequests++;
        throw Object.assign(new Error('Synthetic TLS validation failure'), {
          code: 'CERT_HAS_EXPIRED',
        });
      },
    }),
    /TLS/,
  );
  assert.equal(tlsRequests, 1);
});

test('explicit checks and downloads ignore unreadable saved credentials without changing encrypted storage', async () => {
  const installRoot = folder();
  mkdirSync(path.join(installRoot, 'config'));
  writeFileSync(path.join(installRoot, 'config/release.json'), JSON.stringify({ tag: 'v1.0.0' }));
  const secret = path.join(installRoot, 'data/secrets/github-updates.json');
  mkdirSync(path.dirname(secret), { recursive: true });
  const encrypted = JSON.stringify({
    schemaVersion: 1,
    ciphertext: 'synthetic-unreadable-ciphertext',
  });
  writeFileSync(secret, encrypted);
  let checks = 0,
    downloads = 0;
  const service = new UpdateService({
    root: installRoot,
    state: path.join(installRoot, 'data/desktop'),
    node: process.execPath,
    credential: async () => {
      throw new Error('Saved access is unreadable');
    },
    releases: async (options) => {
      checks++;
      assert.equal(options.token, null);
      assert.equal(options.allowAnonymousFallback, true);
      return [release];
    },
    download: async (selected, directory, options) => {
      downloads++;
      assert.equal(options.token, null);
      assert.equal(selected.sha256, asset.sha256);
      mkdirSync(directory, { recursive: true });
      const file = path.join(directory, asset.sha256 + '.zip');
      writeFileSync(file, bytes);
      return file;
    },
  });
  assert.equal((await service.check()).phase, 'available');
  await assert.rejects(service.prepare(), { code: 'CAPRI_PLATFORM_UNAVAILABLE' });
  assert.equal(checks, 1);
  assert.equal(downloads, 0);
  assert.equal(readFileSync(secret, 'utf8'), encrypted);
  service.close();
});
