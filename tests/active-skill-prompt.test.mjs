import assert from 'node:assert/strict';
import test from 'node:test';
import { interfaceInstruction } from '../apps/desktop/chat-service.mjs';
import { desktopTurnContext } from '../apps/desktop/turn-context.mjs';

test('disabled skills contribute neither instructions nor stale state', () => {
  const state = {
    activeSkills: new Set(['capri.calculator']),
    applications: { calculator: true, notepad: true },
    microphone: true,
    screenObservation: { active: true },
  };
  const instructions = interfaceInstruction(state);
  const context = desktopTurnContext(state);
  assert.match(instructions, /use its calculate action/);
  assert.match(context, /"calculator":true/);
  assert.doesNotMatch(instructions, /time_control|filesystem_control|wakePhrase/);
  assert.doesNotMatch(context, /screenObservation|microphone|notepad/);
});
