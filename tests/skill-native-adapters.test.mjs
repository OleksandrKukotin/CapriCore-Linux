// SPDX-License-Identifier: GPL-3.0-only
import assert from 'node:assert/strict';
import test from 'node:test';
import { CapriCore } from '../packages/core/src/index.mjs';
import { computerSkill } from '../packages/skills/src/computer.mjs';

const callSkill =
  (core, { manifest: { id: skillId } }) =>
  (command, input, source, signal) =>
    core.call({ skillId, command, input }, { source, signal });
