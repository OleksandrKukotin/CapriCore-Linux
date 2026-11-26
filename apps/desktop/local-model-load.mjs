// SPDX-License-Identifier: GPL-3.0-only
import { existsSync, readFileSync, lstatSync } from 'node:fs';
import path from 'node:path';
import {
  assertPrivatePath,
  writePrivateBytesAtomic,
} from '../../packages/runtime/src/safe-file.mjs';
import { LOCAL_LOAD_DEFAULTS, localLoadSettings } from './local-model-load-policy.mjs';

/**
 * The CPU/GPU load limit for the managed language worker. Settings persist and
 * the policy (local-model-load-policy.mjs) is platform-neutral; enforcement was
 * a Windows Job Object helper. The Linux backend will be a cgroup v2 CPUQuota on
 * the llama-server scope (docs/linux/windows-heritage.md, "CPU/GPU load
 * reservation"). Until then the control reports itself as unsupported.
 */
export class LocalModelLoad {
  constructor({ root, dataRoot = root } = {}) {
    this.root = root;
    this.file = path.join(dataRoot, 'data/desktop/local-model-load.json');
    this.settings = { ...LOCAL_LOAD_DEFAULTS };
    this.state = 'unsupported';
    try {
      assertPrivatePath(this.file);
      if (existsSync(this.file)) {
        const info = lstatSync(this.file);
        if (!info.isFile() || info.nlink !== 1 || info.size > 4096) throw Error();
        const saved = JSON.parse(readFileSync(this.file, 'utf8'));
        if (
          saved.schemaVersion !== 1 ||
          Object.keys(saved).some((key) => !['schemaVersion', 'settings'].includes(key))
        )
          throw Error();
        this.settings = localLoadSettings(saved.settings);
      }
    } catch {
      this.warning = 'Saved load limit could not be restored. Defaults are in use.';
    }
  }
  snapshot() {
    return {
      ...this.settings,
      supported: false,
      state: this.state,
      gpuAvailable: false,
      warning: this.warning ?? null,
    };
  }
  set(value) {
    const next = localLoadSettings(value);
    assertPrivatePath(this.file);
    writePrivateBytesAtomic(
      this.file,
      Buffer.from(JSON.stringify({ schemaVersion: 1, settings: next }, null, 2) + '\n'),
    );
    this.settings = next;
    this.warning = null;
    return this.snapshot();
  }
  /** Called by the desktop tick; nothing to enforce without a backend. */
  synchronize() {}
  async stop() {}
  async close() {}
}
