// SPDX-License-Identifier: GPL-3.0-only
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  configureWindowGraphics,
  saveSoftwareRendering,
} from '../apps/desktop/main/window-graphics.mjs';
import { temporaryFolders } from './temporary-folders.mjs';

const temp = temporaryFolders('capri-window-graphics-');

function startup(file) {
  const calls = [];
  const app = {
    commandLine: { appendSwitch: (value) => calls.push(value) },
    disableHardwareAcceleration: () => calls.push('software'),
  };
  return { options: configureWindowGraphics(app, file), calls };
}

test('missing or corrupt graphics preferences keep hardware rendering', () => {
  const file = path.join(temp(), 'window-graphics.json');
  const expected = { options: { softwareRendering: false }, calls: [] };
  assert.deepEqual(startup(file), expected);
  writeFileSync(file, '{');
  assert.deepEqual(startup(file), expected);
});

test('software rendering after a GPU failure is saved and reversible', () => {
  const file = path.join(temp(), 'desktop', 'window-graphics.json');
  saveSoftwareRendering(file, true);
  assert.deepEqual(startup(file), { options: { softwareRendering: true }, calls: ['software'] });
  saveSoftwareRendering(file, false);
  assert.deepEqual(startup(file), { options: { softwareRendering: false }, calls: [] });
});
