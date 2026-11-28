// SPDX-License-Identifier: GPL-3.0-only
import test from 'node:test';
import assert from 'node:assert/strict';
import { CompanionActions } from '../apps/desktop/companion-actions.mjs';
import { CapriCore } from '../packages/core/src/index.mjs';
import { ACTION_SKILLS, registerActionToolSkills } from '../packages/skills/src/action-tools.mjs';

test('legacy aliases dispatch through their registered skills without changing the tool receipts', async (t) => {
  const effects = [];
  const service = (key) => ({
    execute(id, args, signal) {
      signal.throwIfAborted();
      effects.push([key, id, args]);
      return { ok: true, key, id };
    },
    close() {},
  });
  const actions = new CompanionActions({
    root: process.cwd(),
    emit() {},
    desktop: { close() {} },
    applications: service('applications'),
    files: service('files'),
    userTools: {
      run(name, parameters, signal) {
        signal.throwIfAborted();
        effects.push(['user-tools', name, parameters]);
        return { output: 'fixture output' };
      },
    },
    authorizeAction: (tool) => effects.push(['authorize', tool]),
  });
  t.after(() => actions.close());
  for (const [tool, key] of [
    ['application_control', 'applications'],
    ['filesystem_control', 'files'],
  ]) {
    assert.equal(actions.skills.has(ACTION_SKILLS[key]), true);
    assert.deepEqual(await actions.execute(tool, 'operation-1', { action: 'status' }), {
      ok: true,
      key,
      id: 'operation-1',
    });
    assert.deepEqual(effects.splice(0), [
      ['authorize', tool],
      [key, 'operation-1', { action: 'status' }],
    ]);
  }
  assert.deepEqual(await actions.execute('capri_tool_01', 'tool-1', {}), {
    ok: true,
    data: { output: 'fixture output' },
  });
  assert.deepEqual(effects, [
    ['authorize', 'capri_tool_01'],
    ['user-tools', 'capri_tool_01', {}],
  ]);
  effects.length = 0;
  const request = {
    skillId: ACTION_SKILLS.userTools,
    command: 'test',
    input: { name: 'fixture', parameters: {} },
  };
  assert.deepEqual(await actions.skills.call(request, { source: 'settings' }), {
    output: 'fixture output',
  });
  assert.deepEqual(await actions.skills.dispatch(request, { source: 'tool' }), {
    status: 'failed',
    code: 'skill_access_denied',
  });
  assert.deepEqual(effects, [['user-tools', 'fixture', {}]]);
});

test('user-tool management preserves Settings results and owner-only commands', async (t) => {
  const core = new CapriCore();
  t.after(() => core.close());
  const effects = [];
  const tools = [{ id: 'fixture', enabled: true }];
  const invalidSettings = new Error('Use a small JSON object of private string settings.');
  registerActionToolSkills(core, {
    userTools: {
      run() {},
      list: () => tools,
      refresh: async () => tools,
      enable: async (id, enabled) => [{ id, enabled }],
      saveSettings: async (id, value) => {
        assert.equal(id, 'fixture');
        if (value === null) throw invalidSettings;
        assert.deepEqual(value, { key: 'sample secret' });
        return { saved: true };
      },
      cancel: () => effects.push('cancel user tool'),
      example: async () => tools,
    },
  });
  const call = (skill, command, input, source = 'settings') =>
    core.call({ skillId: ACTION_SKILLS[skill], command, input }, { source });
  assert.equal(call('userTools', 'status'), tools);
  assert.equal(await call('userTools', 'refresh'), tools);
  assert.deepEqual(await call('userTools', 'enable', { id: 'fixture', enabled: false }), [
    { id: 'fixture', enabled: false },
  ]);
  assert.deepEqual(
    await call('userTools', 'settings', { id: 'fixture', settings: { key: 'sample secret' } }),
    { saved: true },
  );
  await assert.rejects(
    call('userTools', 'settings', { id: 'fixture', settings: null }),
    invalidSettings,
  );
  assert.equal(call('userTools', 'stop'), true);
  assert.equal(await call('userTools', 'example'), tools);
  assert.deepEqual(effects, ['cancel user tool']);
  for (const [skill, commands] of [
    ['userTools', ['status', 'refresh', 'enable', 'settings', 'stop', 'example']],
  ]) {
    for (const command of commands)
      assert.throws(() => call(skill, command, undefined, 'tool'), {
        code: 'skill_access_denied',
      });
  }
});

test('file trash keeps the approval and full-access behavior of the desktop bridge', async (t) => {
  let fullAccess = false;
  const effects = [];
  const actions = new CompanionActions({
    root: process.cwd(),
    emit() {},
    fullAccess: () => fullAccess,
    desktop: {
      execute(id, args, approvals, signal) {
        signal.throwIfAborted();
        effects.push(['propose', id, args]);
        return approvals.propose({
          title: 'Review trash',
          detail: 'Fixture file',
          kind: 'trash',
          execute: () => {
            effects.push(['trash', id]);
            return { ok: true, confirmation: 'Moved to Recycle Bin.' };
          },
        });
      },
      close() {},
    },
    authorizeAction: (tool) => effects.push(['authorize', tool]),
  });
  t.after(() => actions.close());
  const args = { action: 'trash' };
  const pending = await actions.execute('filesystem_control', 'trash-1', args);
  assert.equal(pending.needsApproval, true);
  assert.deepEqual(effects.splice(0), [
    ['authorize', 'filesystem_control'],
    ['propose', 'trash-1', args],
  ]);
  assert.equal((await actions.approvals.respond(pending.proposal.id, true)).ok, true);
  assert.deepEqual(effects.splice(0), [['trash', 'trash-1']]);

  fullAccess = true;
  assert.equal((await actions.execute('filesystem_control', 'trash-2', args)).ok, true);
  assert.deepEqual(effects.splice(0), [
    ['authorize', 'filesystem_control'],
    ['propose', 'trash-2', args],
    ['trash', 'trash-2'],
  ]);
  assert.deepEqual(
    await actions.skills.dispatch(
      { skillId: ACTION_SKILLS.files, command: 'trash', input: args },
      { source: 'settings' },
    ),
    { status: 'failed', code: 'skill_access_denied' },
  );
  assert.deepEqual(effects, []);
});
