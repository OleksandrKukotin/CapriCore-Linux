// SPDX-License-Identifier: GPL-3.0-only
import { EventEmitter } from 'node:events';
import { platformUnavailable } from '../../packages/runtime/src/host/platform.mjs';

/**
 * App awareness: foreground app, browser tab, lock/suspend events as metadata
 * only (never images or titles). The Windows event hook is gone; the Linux
 * sources are logind D-Bus, ext-idle-notify and wlr-foreign-toplevel
 * (docs/linux/windows-heritage.md, "Awareness events"). Events: 'status',
 * 'observation', 'browser-tab-changed', 'failure'.
 */
export class AwarenessObserver extends EventEmitter {
  constructor() {
    super();
    this.status = 'off';
  }
  snapshot() {
    return {
      status: this.status,
      active: this.status === 'active',
      capturesImages: false,
      capturesTitles: false,
      lastFailure: null,
    };
  }
  publish(status) {
    this.status = status;
    this.emit('status', this.snapshot());
  }
  async start() {
    throw platformUnavailable('App awareness');
  }
  stop() {
    if (this.status !== 'off') this.publish('off');
  }
}
