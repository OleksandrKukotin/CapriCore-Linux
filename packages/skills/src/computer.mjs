// SPDX-License-Identifier: GPL-3.0-only
import { isRecord, noInput, SKILL_API_VERSION } from '../../skill-sdk/src/index.mjs';

const boolean = (value) => typeof value === 'boolean';
const accessState = (value) => isRecord(value) && boolean(value.enabled);

/** The Full computer access grant. App actions themselves belong to capri.applications. */
export const computerSkill = {
  manifest: {
    id: 'capri.computer',
    apiVersion: SKILL_API_VERSION,
    version: '2.0.0',
    requires: ['access', 'requests', 'isApplicationAccessEnabled'],
    ui: { sectionId: 'computer', labelKey: 'Computer control' },
    commands: {
      accessStatus: {
        input: noInput,
        output: accessState,
        sources: ['host', 'companion', 'settings'],
      },
      setAccess: { input: boolean, output: accessState, sources: ['companion', 'settings'] },
      requestAccess: { input: boolean, output: accessState, sources: ['chat', 'tool'] },
    },
  },
  create({ ports: { access, requests, isApplicationAccessEnabled } }) {
    const commands = {
      accessStatus: () => ({ ...access.snapshot(), paused: !isApplicationAccessEnabled() }),
      setAccess: (enabled, signal) => access.configure(enabled, { signal }),
      requestAccess: (enabled, signal) => requests.configure(enabled, { signal }),
    };
    return {
      invoke: (command, input, { signal }) => commands[command](input, signal),
    };
  },
};
