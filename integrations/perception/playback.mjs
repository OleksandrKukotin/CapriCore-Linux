// SPDX-License-Identifier: GPL-3.0-only

/**
 * Reads the playing track (title, position, duration) of the observed window.
 * The Windows media-session helper is gone; MPRIS over D-Bus replaces it
 * (docs/linux/windows-heritage.md, "Media and music"). No reading means unknown.
 */
export function createPlaybackReader() {
  return async () => null;
}
