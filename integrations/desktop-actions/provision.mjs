// SPDX-License-Identifier: GPL-3.0-only
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { platformUnavailable } from '../../packages/runtime/src/host/platform.mjs';

/**
 * Built the Windows helper for this integration. The Linux backend will use
 * AT-SPI2 for the accessibility tree and the RemoteDesktop portal (libei) for input; see docs/linux/windows-heritage.md.
 */
export function ensureDesktopActions() {
  throw platformUnavailable('Desktop application actions');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.error('Desktop application actions is not available on Linux yet.');
  process.exitCode = 1;
}
