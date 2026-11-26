// SPDX-License-Identifier: GPL-3.0-only
import { realpathSync, statSync } from 'node:fs';
import { findExecutable } from '../../../packages/runtime/src/host/paths.mjs';
import { silentChessTrace } from './diagnostics.mjs';

export const STOCKFISH_VERSION = '19';

/** The distribution's Stockfish (for example `pacman -S stockfish`), resolved through links. */
export function systemStockfish(env = process.env) {
  const found = findExecutable('stockfish', {
    env,
    extra: ['/usr/games/stockfish', '/usr/bin/stockfish'],
  });
  if (!found) return null;
  try {
    const file = realpathSync(found);
    const info = statSync(file);
    return info.isFile() && (info.mode & 0o111) !== 0 ? file : null;
  } catch {
    return null;
  }
}

/**
 * On Windows Capri downloaded a pinned Stockfish build. On Linux the engine comes
 * from the system package manager; this keeps the same snapshot/install API.
 */
export class ChessEngineInstall {
  constructor({ progress = () => {}, trace = silentChessTrace, locate = systemStockfish } = {}) {
    Object.assign(this, { progress, trace, locate });
    this.state = { phase: 'idle', received: 0, total: 0 };
  }

  snapshot() {
    return {
      ...this.state,
      installed: Boolean(this.locate()),
      version: STOCKFISH_VERSION,
      supported: true,
      packageManaged: true,
    };
  }

  async verifiedExecutable() {
    const file = this.locate();
    if (!file) throw new Error('Install Stockfish with your package manager first');
    return file;
  }

  publish(state) {
    this.state = { ...this.state, ...state };
    this.progress(this.snapshot());
  }

  async install() {
    const current = this.snapshot();
    this.trace('install', { version: STOCKFISH_VERSION, supported: true })('completed', {
      installed: current.installed,
    });
    if (!current.installed)
      throw new Error('Install Stockfish with your package manager (for example: stockfish).');
    return current;
  }

  cancel() {}

  async remove() {
    throw new Error('Stockfish is managed by your package manager.');
  }
}
