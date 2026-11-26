// SPDX-License-Identifier: GPL-3.0-only
import { platformUnavailable } from '../../packages/runtime/src/host/platform.mjs';

/**
 * Named system-audio endpoints for call routing and music listening. The Linux
 * backend is PipeWire (`pw-record --target <sink>.monitor`, 16 kHz mono); until
 * it exists no endpoint is listed and capture reports a platform error. Keep the
 * silence-clock rule from the Windows helper: an idle sink sends no packets.
 */
export class AudioEndpoints {
  async list() {
    return [];
  }
  async capture() {
    throw platformUnavailable('System audio capture');
  }
}
