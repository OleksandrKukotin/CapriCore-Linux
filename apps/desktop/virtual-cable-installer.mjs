// SPDX-License-Identifier: GPL-3.0-only
import { platformUnavailable } from '../../packages/runtime/src/host/platform.mjs';

/**
 * Call audio needs a virtual cable that other apps can record. On Windows Capri
 * installed the VB-CABLE driver. On Linux no driver is needed: a PipeWire null
 * sink (`pactl load-module module-null-sink sink_name=capri_call`) is the cable.
 * Until that backend exists, setup reports a platform error.
 */
export class VirtualCableInstaller {
  constructor({ emit = () => {} } = {}) {
    this.emit = emit;
    this.state = { phase: 'idle', busy: false };
  }
  snapshot() {
    return { ...this.state };
  }
  whenSettled() {
    return Promise.resolve();
  }
  publish(value) {
    Object.assign(this.state, value);
    this.emit(this.snapshot());
  }
  async install() {
    throw platformUnavailable('Call audio');
  }
}
