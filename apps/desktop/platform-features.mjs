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
  /** Browser tab awareness for "wild tabs" reactions (MPRIS / foreign-toplevel). */
  browserTabs: false,
  /** Tray balloon notices for available updates (use Notification on Linux). */
  trayBalloons: false,
  /** Enumerating other apps' windows to locate Capri's own surfaces (no Wayland API). */
  windowEnumeration: false,
  /** Virtual call camera (v4l2loopback). */
  virtualCamera: false,
  /**
   * Click-through outside Capri's shape. It needs the global cursor position
   * while the window ignores the mouse, which Wayland never reveals, so the
   * window would stay unclickable. Linux keeps the window clickable instead.
   * BrowserWindow.setShape cannot help: on Wayland (Electron 45) it never
   * changes the input region. The layer-shell overlay in apps/overlay can.
   */
  pointerPassthrough: false,
});

/**
 * Whether Capri can place her own windows. A Wayland client cannot: the
 * compositor ignores requested positions, getBounds() only echoes them back and
 * the global cursor reads 0,0. Moving the window is then the compositor's job
 * (-webkit-app-region: drag); resizing by cursor polling, roaming, teleports
 * and perching stay off.
 */
export function clientPlacesWindows({
  platform = process.platform,
  ozonePlatform = '',
  sessionType = '',
} = {}) {
  if (platform !== 'linux') return true;
  // Electron records the backend it picked; fall back to the session type.
  const backend = ozonePlatform || (sessionType === 'wayland' ? 'wayland' : 'x11');
  return backend !== 'wayland';
}
