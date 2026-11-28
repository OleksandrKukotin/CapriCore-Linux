// SPDX-License-Identifier: GPL-3.0-only
import { uiText } from './interface-translations.mjs';

/** Shared host entry point for chat and tools to change the Full computer access grant. */
export class ComputerRequests {
  constructor({ access, language = () => 'en' }) {
    Object.assign(this, { access, language });
  }
  async configure(enabled, { signal } = {}) {
    signal?.throwIfAborted();
    const state = await this.access.configure(enabled, { signal });
    signal?.throwIfAborted();
    const applied = state.enabled === enabled;
    const summary = uiText(
      !applied
        ? 'Cancelled.'
        : enabled
          ? 'Full computer access is enabled.'
          : 'Full computer access is off.',
      this.language(),
    );
    return {
      ok: applied,
      enabled: state.enabled,
      cancelled: !applied,
      status: applied ? 'completed' : 'cancelled',
      steps: 0,
      confirmation: summary,
      summary,
      instruction: applied
        ? 'Report this actual access state. Access alone does not complete any requested app action.'
        : 'The owner did not grant access. Stop this task; do not repeat the request or switch to another tool.',
    };
  }
}
