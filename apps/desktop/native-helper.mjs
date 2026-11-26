// SPDX-License-Identifier: GPL-3.0-only
import { platformUnavailable } from '../../packages/runtime/src/host/platform.mjs';

/**
 * Native helpers (task recording, the tool sandbox, audio endpoints, browser
 * media control) were Windows executables. Callers keep their policy code and
 * receive a platform error until each helper has a Linux implementation.
 */
export async function prepareNativeHelper(_root, name) {
  throw platformUnavailable(`The ${name} helper`);
}
