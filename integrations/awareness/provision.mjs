// SPDX-License-Identifier: GPL-3.0-only
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { platformUnavailable } from '../../packages/runtime/src/host/platform.mjs';

/**
 * Built the Windows helper for this integration. The Linux backend will use
 * logind D-Bus, ext-idle-notify and wlr-foreign-toplevel; see docs/linux/windows-heritage.md.
 */
export function ensureAwareness() {
  throw platformUnavailable('App awareness');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.error('App awareness is not available on Linux yet.');
  process.exitCode = 1;
}
