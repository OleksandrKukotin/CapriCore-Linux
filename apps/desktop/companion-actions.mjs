// SPDX-License-Identifier: GPL-3.0-only
import path from 'node:path';
import { CapriCore } from '../../packages/core/src/index.mjs';
import {
  ACTION_SKILLS,
  isUserToolAlias,
  registerActionToolSkills,
} from '../../packages/skills/src/action-tools.mjs';
import { timerClient, timerSkill } from '../../packages/skills/src/timers/index.mjs';
import { TimeService } from '../../packages/runtime/src/time/service.mjs';
import { ActionBroker, ActionApprovals } from './action-broker.mjs';

/** Main-process owner: survives model unload, never depends on generated conversation. */
export class CompanionActions {
  constructor({
    root,
    emit,
    deliver,
    settings,
    setSetting,
    requestSetting,
    desktop,
    files,
    fullAccess = () => false,
    requestComputerAccess,
    applications,
    userTools,
    authorizeAction = () => {},
    onResult = () => {},
    formatElapsed = (time) => 'Elapsed time: ' + time + '.',
    skills,
  }) {
    Object.assign(this, { emit, settings, setSetting, requestSetting, desktop });
    Object.assign(this, {
      files,
      onResult,
      fullAccess,
      requestComputerAccess,
      applications,
      userTools,
      authorizeAction,
    });
    this.approvals = new ActionApprovals({ emit });
    this.skills = skills ?? new CapriCore();
    this.ownsSkills = !skills;
    registerActionToolSkills(this.skills, {
      applications,
      files,
      userTools,
      ...(typeof desktop?.execute === 'function'
        ? {
            trash: (id, args, signal) =>
              desktop.execute(
                id,
                args,
                this.fullAccess() ? { propose: (proposal) => proposal.execute() } : this.approvals,
                signal,
              ),
          }
        : {}),
    });
    this.skills.register(timerSkill, {
      formatElapsed,
      createTimeService: (changed) =>
        new TimeService({ file: path.join(root, 'data/desktop/time.sqlite'), deliver, changed }),
    });
    this.unsubscribeTime = this.skills.subscribe(
      { skillId: timerSkill.manifest.id, event: 'changed' },
      ({ data: objects }) => emit({ type: 'time.changed', objects }),
    );
    this.time = timerClient(this.skills);
    this.broker = new ActionBroker({
      root,
      execute: ({ tool, id, args, signal }) => this.execute(tool, id, args, signal),
    });
  }
  async start() {
    await this.broker.start();
    this.time.start();
  }
  async execute(tool, id, args, signal) {
    const notify = (result) => {
      try {
        this.onResult?.(tool, args, result);
      } catch {
        console.warn('Action result observer failed.');
      }
    };
    try {
      const result = await CompanionActions.prototype.executeAction.call(
        this,
        tool,
        id,
        args,
        signal,
      );
      notify(result);
      return result;
    } catch (error) {
      notify({ ok: false, error: { code: error.code ?? 'action_failed' } });
      throw error;
    }
  }
  async executeAction(tool, id, args, signal) {
    signal?.throwIfAborted();
    // Enforce the active owner's domain before any generated tool can create
    // an overlay, request broader access or send native input.
    this.authorizeAction?.(tool, args);
    const invoke = (skillId, command, input) =>
      this.skills.call({ skillId, command, input, requestId: id }, { source: 'tool', signal });
    if (isUserToolAlias(tool)) {
      if (!this.userTools) throw new Error('User tools are unavailable.');
      return invoke(ACTION_SKILLS.userTools, 'run', { name: tool, parameters: args });
    }
    if (tool === 'application_control') {
      const calculation = args?.action === 'calculate';
      const skillId = calculation ? ACTION_SKILLS.calculator : ACTION_SKILLS.applications;
      if (!this.skills?.has(skillId)) throw new Error('The requested application is unavailable.');
      return invoke(skillId, calculation ? 'calculate' : 'execute', args);
    }
    if (tool === 'time_control') return this.time.execute(id, args, { source: 'tool', signal });
    if (tool === 'filesystem_control')
      return invoke(ACTION_SKILLS.files, args?.action === 'trash' ? 'trash' : 'execute', args);
    if (tool === 'desktop_control')
      return this.desktop.execute(
        id,
        args,
        this.fullAccess() ? { propose: (proposal) => proposal.execute() } : this.approvals,
        signal,
      );
    if (
      tool !== 'settings_control' ||
      !args ||
      Object.keys(args).some((key) => !['action', 'setting', 'value'].includes(key))
    )
      throw new Error('Invalid settings command.');
    if (args.action === 'status') return { ok: true, settings: this.settings() };
    if (args.action === 'request' && args.setting === 'fullComputerAccess') {
      if (
        (args.value !== undefined && typeof args.value !== 'boolean') ||
        !this.requestComputerAccess
      )
        throw new Error('Invalid full computer access request.');
      return this.requestComputerAccess(args.value ?? true, { signal });
    }
    if (args.action === 'set' && ['glitchEnabled', 'glitchStrength'].includes(args.setting)) {
      const value = args.value;
      if (
        args.setting === 'glitchEnabled'
          ? typeof value !== 'boolean'
          : !Number.isInteger(value) || value < 0 || value > 100
      )
        throw new Error('Invalid setting value.');
      return { ok: true, setting: args.setting, value: await this.setSetting(args.setting, value) };
    }
    if (
      args.action !== 'request' ||
      (args.value !== undefined && args.value !== true) ||
      !['screenObservation', 'notepad', 'calculator', 'languages', 'models'].includes(args.setting)
    )
      throw new Error('That setting needs its dedicated controls.');
    if (args.setting === 'screenObservation' && this.settings?.().screenObservation === true)
      return {
        ok: true,
        enabled: true,
        alreadyEnabled: true,
        needsApproval: false,
        captureStarted: false,
        instruction:
          'Screen observation is already active for the owner-selected source. No new approval or picker is needed. Answer from the current read-only scene supplied with this turn. If no current scene is available, say that this update is unavailable; do not invent it or call other tools to obtain permission. This call did not start or stop capture.',
      };
    const result = await this.requestSetting(args.setting, this.approvals);
    if (args.setting !== 'screenObservation' || !result?.needsApproval) return result;
    return {
      ...result,
      effect: 'open_screen_picker',
      captureStarted: false,
      instruction:
        'A real desktop approval is pending. End your reply and wait for the owner to confirm using the buttons or yes/confirm. This is NOT an error. Do not call apps, filesystem or other tools to enable observation. Approval opens Screen snapshot settings only; the owner must then select a window or monitor and press Start observation. No capture has been started by this request. Never ask for terminal commands, tokens or workspace files.',
    };
  }
  close() {
    if (this.closed) return;
    this.closed = true;
    this.approvals.cancel();
    this.broker.close();
    this.unsubscribeTime();
    if (this.ownsSkills) void this.skills.close();
    void this.files?.close();
    void this.applications?.close();
    void Promise.resolve(this.desktop.close()).catch((error) =>
      console.warn('Desktop journal could not close:', error.message),
    );
  }
}
