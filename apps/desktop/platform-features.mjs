// SPDX-License-Identifier: GPL-3.0-only
/**
 * Desktop features that need an OS backend. Each was implemented with a Windows
 * helper; the JS around it is kept and switched off here until its Linux backend
 * exists. Flip a flag only together with that backend. The planned mechanism for
 * each is described in docs/linux/windows-heritage.md.
 */
export const platformFeatures = Object.freeze({
  /** Named audio endpoints for call routing (PipeWire). */
  audioRouting: false,
  /** System-audio music detection (PipeWire monitor source). */
  musicListening: false,
  /** Browser tab awareness for "wild tabs" reactions (MPRIS / foreign-toplevel). */
  browserTabs: false,
  /** Tray balloon notices for available updates (use Notification on Linux). */
  trayBalloons: false,
  /** Enumerating other apps' windows to locate Capri's own surfaces (no Wayland API). */
  windowEnumeration: false,
  /** Launching Steam games from the installed library. */
  steamGames: false,
  /** Virtual call camera (v4l2loopback). */
  virtualCamera: false,
});
