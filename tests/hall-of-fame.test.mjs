// SPDX-License-Identifier: GPL-3.0-only
import test from 'node:test';
import assert from 'node:assert/strict';
import configured from '../config/hall-of-fame.json' with { type: 'json' };

const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

test('the shipped roster is a static public snapshot with only approved fields', () => {
  assert.deepEqual(Object.keys(configured).sort(), [
    'communityHelpers',
    'epithets',
    'majorSupporters',
    'schemaVersion',
    'snapshotDate',
    'source',
    'supporters',
    'team',
  ]);
  assert.equal(configured.schemaVersion, 1);
  assert.equal(configured.source, 'CapriChooms/Capri');
  assert.match(configured.snapshotDate, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(
    new Date(configured.snapshotDate).toISOString().slice(0, 10),
    configured.snapshotDate,
  );
  assert(configured.supporters.length > 0);
  for (const login of configured.supporters)
    assert.match(login, /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/);
  const keys = configured.supporters.map((login) => login.toLowerCase());
  assert.equal(new Set(keys).size, keys.length);
  assert.deepEqual(configured.supporters, [...configured.supporters].sort(collator.compare));
  assert.deepEqual(configured.team, [
    { name: 'Overyx', role: 'Developer' },
    { name: 'v1rch', role: 'Discord developer' },
    { name: 'Leberrr', role: 'Discord moderator' },
  ]);
});
