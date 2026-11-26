// SPDX-License-Identifier: GPL-3.0-only
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  YouTubeMusicService,
  validateYouTubeMusicCommand,
} from '../integrations/youtube-music/service.mjs';

test('YouTube Music validates provider commands before any browser access', () => {
  assert.deepEqual(validateYouTubeMusicCommand({ action: 'play', query: '  Hikari' }), {
    action: 'play',
    query: 'Hikari',
  });
  assert.deepEqual(validateYouTubeMusicCommand({ action: 'start' }), { action: 'start' });
  for (const invalid of [
    { action: 'play' },
    { action: 'start', query: 'Invented track' },
    { action: 'play', query: 'song\nname' },
    { action: 'play', query: 'song', url: 'https://example.com' },
    { action: 'play', query: 'song', waitForSearch: true },
    { action: 'open', binding: '111:222:333' },
    { action: 'pause', query: 'another tab' },
    { action: 'volume', value: 20, delta: -5 },
    { action: 'volume', value: 105 },
    { action: 'volume', value: '50' },
    { action: 'volume', delta: NaN },
  ])
    assert.throws(() => validateYouTubeMusicCommand(invalid), /YouTube Music/);
});

test('without a Linux browser backend YouTube Music reports unsupported and touches nothing', async () => {
  const service = new YouTubeMusicService({
    root: 'fixture',
    openExternal: () => assert.fail('No URL may be opened'),
    prepare: () => assert.fail('No helper may be prepared'),
    run: () => assert.fail('No helper may run'),
  });
  try {
    for (const command of [{ action: 'open' }, { action: 'play', query: 'Hikari' }])
      assert.deepEqual(await service.execute(`call-${command.action}`, command), {
        ok: false,
        status: 'unsupported',
      });
    assert.throws(() => service.execute('', { action: 'open' }), /operation ID/);
  } finally {
    service.close();
  }
  await assert.rejects(service.execute('after-close', { action: 'open' }));
});
