// SPDX-License-Identifier: GPL-3.0-only
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { ComputerControl } from '../apps/desktop/computer-control.mjs';

const leftPane = 'a'.repeat(64);
const rightPane = 'b'.repeat(64);
async function observation(controls, applicationKind = 'discord', inspect, scan) {
  const mutations = [];
  const control = new ComputerControl({
    allowed: () => true,
    canStart: () => true,
    currentTurn: () => 'synthetic-pane-qa',
    registerEscape: () => true,
    unregisterEscape: () => {},
    showBorder: async () => {},
    hideBorder: () => {},
    bridge: async (command) => {
      const { action } = command;
      if (action !== 'computer_state') {
        mutations.push(command);
        return { ok: true };
      }
      return {
        ok: true,
        windowId: '100',
        processId: '200',
        startedAtTicks: '300',
        applicationKind,
        discordComposerScan: scan,
        untrustedTitle: 'Synthetic pane observation',
        x: 0,
        y: 0,
        width: 1000,
        height: 600,
        untrustedControls: controls.map((item, index) => ({
          id: String(index),
          untrustedName: 'Synthetic control',
          x: 100 + index * 100,
          y: 500,
          ...item,
        })),
      };
    },
  });
  await control.begin('Verify metadata only');
  try {
    const view = await control.execute({ action: 'observe', vision: false });
    return inspect ? await inspect(control, view, mutations) : view;
  } finally {
    await control.stop();
  }
}

test('native pane metadata survives host observation with distinct left/right context and strict composer/message flags', async () => {
  const view = await observation([
    {
      type: 'ControlType.Edit',
      editable: true,
      discordPaneId: leftPane,
      discordMessageComposer: true,
    },
    {
      type: 'ControlType.Edit',
      editable: true,
      discordPaneId: rightPane,
      discordMessageComposer: true,
    },
    { type: 'ControlType.Text', editable: false, discordPaneId: rightPane, discordMessage: true },
  ]);
  assert.equal(view.targets[0].discordPaneId, leftPane);
  assert.equal(view.targets[1].discordPaneId, rightPane);
  assert.equal(view.targets[1].discordMessageComposer, true);
  assert.equal(view.targets[2].discordPaneId, rightPane);
  assert.equal(view.targets[2].discordMessage, true);
  assert.equal(view.targets[2].discordMessageComposer, undefined);
  assert.ok(view.targets[1].position.x > view.targets[0].position.x);
});

test('composer inventory is host-only, bounded and strictly typed', async () => {
  for (const scan of [
    { complete: true, count: 2 },
    { complete: false, count: 8 },
  ]) {
    const view = await observation([], 'discord', undefined, scan);
    assert.deepEqual(view.window.discordComposerScan, scan);
  }
  for (const scan of [
    { complete: 'true', count: 1 },
    { complete: true, count: 9 },
    { complete: true, count: -1 },
    { complete: true, count: 1.5 },
  ]) {
    assert.equal(
      (await observation([], 'discord', undefined, scan)).window.discordComposerScan,
      undefined,
    );
  }
  assert.equal(
    (await observation([], 'other', undefined, { complete: true, count: 1 })).window
      .discordComposerScan,
    undefined,
  );
});

test('only trusted third-argument Discord preconditions enter the native mutation request', async () => {
  const expectedValueSha256 = createHash('sha256').update('').digest('hex');
  await observation(
    [
      {
        type: 'ControlType.Edit',
        editable: true,
        focused: true,
        discordPaneId: rightPane,
        discordMessageComposer: true,
      },
    ],
    'discord',
    async (control, view, calls) => {
      let command = { action: 'enter_text', targetId: view.targets[0].targetId, text: 'hi' };
      await control.execute({ ...command, expectedValueSha256, expectedDiscordPaneId: rightPane });
      assert.equal(
        calls.find((call) => call.action === 'computer_type').expectedValueSha256,
        undefined,
        'public command properties are not trusted',
      );
      const discordMutation = { expectedValueSha256, expectedDiscordPaneId: rightPane };
      let fresh = await control.execute({ action: 'observe', vision: false });
      command = { ...command, targetId: fresh.targets[0].targetId };
      await control.execute(command, undefined, { discordMutation });
      const typed = calls.filter((call) => call.action === 'computer_type');
      assert.equal(typed[1].expectedValueSha256, expectedValueSha256);
      assert.equal(typed[1].expectedDiscordPaneId, rightPane);
      fresh = await control.execute({ action: 'observe', vision: false });
      const enter = { action: 'press_keys', keys: ['ENTER'], observationId: fresh.observationId };
      await control.execute(enter, undefined, { discordMutation });
      const submitted = calls.find((call) => call.action === 'computer_keys');
      assert.equal(submitted.focusedControlId, '0');
      assert.equal(submitted.expectedDiscordPaneId, rightPane);
      const before = calls.length;
      for (const invalid of [
        { ...discordMutation, expectedDiscordPaneId: leftPane },
        { ...discordMutation, expectedValueSha256: 'invalid' },
        { ...discordMutation, extra: true },
      ]) {
        fresh = await control.execute({ action: 'observe', vision: false });
        command = { ...command, targetId: fresh.targets[0].targetId };
        await assert.rejects(
          control.execute(command, undefined, { discordMutation: invalid }),
          /composer changed/,
        );
      }
      fresh = await control.execute({ action: 'observe', vision: false });
      await assert.rejects(
        control.execute(
          { ...enter, observationId: fresh.observationId, keys: ['CTRL', 'ENTER'] },
          undefined,
          { discordMutation },
        ),
        /composer changed/,
      );
      assert.equal(calls.length, before);
    },
  );
});

test('malformed pane IDs, headers, editable message text and another application cannot acquire trusted metadata', async () => {
  const view = await observation([
    {
      type: 'ControlType.Edit',
      editable: true,
      discordPaneId: [rightPane],
      discordMessageComposer: true,
    },
    {
      type: 'ControlType.Edit',
      editable: true,
      discordPaneId: rightPane.toUpperCase(),
      discordMessageComposer: true,
    },
    {
      type: 'ControlType.Button',
      discordPaneId: rightPane,
      discordMessage: true,
      discordMessageComposer: true,
    },
    { type: 'ControlType.Text', editable: true, discordPaneId: rightPane, discordMessage: true },
    { type: 'ControlType.Text', editable: false, discordPaneId: rightPane, discordMessage: 'true' },
  ]);
  for (const target of view.targets) assert.equal(target.discordMessage, undefined);
  assert.equal(view.targets[0].discordPaneId, undefined);
  assert.equal(view.targets[1].discordPaneId, undefined);
  assert.equal(view.targets[2].discordMessageComposer, undefined);
  assert.equal(view.targets[3].discordMessageComposer, undefined);
  const foreign = await observation(
    [
      {
        type: 'ControlType.Edit',
        editable: true,
        discordPaneId: rightPane,
        discordMessage: true,
        discordMessageComposer: true,
      },
    ],
    'other',
  );
  assert.equal(foreign.targets[0].discordPaneId, undefined);
  assert.equal(foreign.targets[0].discordMessage, undefined);
  assert.equal(foreign.targets[0].discordMessageComposer, undefined);
});
