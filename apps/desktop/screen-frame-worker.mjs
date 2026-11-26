// SPDX-License-Identifier: GPL-3.0-only
import { platformUnavailable } from '../../packages/runtime/src/host/platform.mjs';

/**
 * Screen frames for observation, clips and computer control. The Windows worker
 * used GDI/PrintWindow. On Linux frames come from the ScreenCast portal or, on
 * wlroots compositors, wlr-screencopy (`grim`); see docs/linux/windows-heritage.md.
 */
export class ScreenFrameWorker {
  async frame() {
    throw platformUnavailable('Screen capture');
  }
  close() {}
  dispose() {}
}
