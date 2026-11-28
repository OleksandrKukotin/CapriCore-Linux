// SPDX-License-Identifier: GPL-3.0-only
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  AUDIO_ROUTING_DEFAULTS,
  audioRouteRequest,
  audioRoutingPreferences,
} from '../apps/desktop/audio-routing.mjs';

test('a first audio preference stores an endpoint ID independently of its display label', () => {
  const value = structuredClone(AUDIO_ROUTING_DEFAULTS);
  value.routes.system = '{capture-device-id}';
  value.routeLabels.system = 'Virtual Cable';
  const saved = audioRoutingPreferences(value);
  assert.equal(saved.routes.system, '{capture-device-id}');
  assert.equal(saved.routeLabels.system, 'Virtual Cable');
  assert.equal(saved.routes.call, '');
  assert.throws(() => audioRouteRequest({ route: 'system', deviceId: 'bad\u0000id' }));
});
