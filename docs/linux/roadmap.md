# CapriCore-Linux roadmap

What comes next for the Linux fork, in rough order. Updated 2026-11-26, after
PR #1 (Linux port) and PR #2 (test suite and CI) were merged.

The [product roadmap](../../ROADMAP.md) has the longer-term epics and their Linux
status. The [Windows heritage](windows-heritage.md) page has the design rules and the
planned Linux mechanism for each feature. This page tracks the order of work.

## Where things stand

- Capri starts on Arch Linux with sway (Wayland) and chats through the
  [Claude Code bridge](../../README.md#chat-through-claude-code-no-model-download),
  with no model download.
- CI runs on Ubuntu and passes in about 2 minutes: 2109 JS tests, the Python
  unit tests, the recognition lock install and the ASR tests.
- Speech setup is ported to Node (`node tools/setup/setup.mjs`), but most Python
  locks are still the Windows ones.

## Next

### 1. Faster Claude Code chat

A reply through the bridge takes about 20 s, mostly because Capri's agent prompt
is large: persona plus about 30 tool descriptions the bridge cannot use.

- [ ] Measure where the time goes: CLI startup, prompt size, first token.
- [ ] Drop tool definitions and tool instructions from requests the bridge
      receives, since it is text only.
- [ ] Only if startup still matters afterwards: a long-lived `claude` process
      per conversation (`--input-format stream-json`). Weigh its memory cost and
      history drift against the gain.

### 2. Companion window on Wayland

Tested on labwc with Electron 45 and `WAYLAND_DEBUG=1`. A Wayland client cannot
place its own window: `setPosition` is ignored while `getBounds()` echoes it,
and `getCursorScreenPoint()` reads 0,0. `setShape` never changes the input
region (`setIgnoreMouseEvents` does, but cannot be undone without a cursor).

- [x] Dragging the window: on Wayland the header is a `-webkit-app-region: drag`
      region, so the compositor moves it (`xdg_toplevel.move`).
- [x] Features that place the window (roaming, teleports, perching, detach hops)
      are off on Wayland; Settings shows roaming as unavailable.
- [ ] Resizing. The edges poll the cursor, so they are hidden on Wayland.
      `resizable: true` would let the compositor resize (`xdg_toplevel.resize`),
      but Electron's Linux `resize` event cannot tell a user resize from Capri's
      own `setBounds` calls, and the size clamp would undo it. Mark Capri's own
      resizes first, then save the rest.
- [ ] Only Capri's shape should catch clicks. Electron cannot do this on
      Wayland; a layer-shell surface can (`apps/overlay` already sets its input
      region from the sprite's alpha).
- [ ] Show the avatar through the layer-shell overlay: Electron renders the
      companion offscreen and streams frames and the hit mask to
      `capri-overlay`, which passes pointer events back. Layer-shell margins
      also restore roaming, teleports and perching. GNOME has no layer-shell
      and keeps the Electron window.

### 3. Speech

- [ ] Recognition: the existing `asr-requirements.lock.txt` installs on Linux
      (CI proved it). Try `node tools/setup/setup.mjs recognition` on a real
      machine.
- [ ] Recompile the hashed and GPU locks for `x86_64-manylinux_2_28`: router,
      Qwen, and the legacy, Blackwell and AMD voice locks. This needs a good
      connection.
- [ ] Accelerated Qwen voice: replace the `win_amd64` wheel pins in
      `integrations/voice_runtime/qwen_gpu_setup.py`.
- [ ] Re-measure `config/speech-storage.json`; its sizes are Windows numbers.
- [ ] Setup must die with a crashed Capri (heritage rule 3). `--pdeathsig`
      alone is not enough: it signals only the one process it is set on, and
      `uv`/`pip` children would keep running. Run a small watchdog under
      `setpriv --pdeathsig TERM` that kills the whole setup process group
      (`kill -TERM -<pgid>`) when it receives that signal.

### 4. Memory recall

- [ ] Install `llama-cpp` with a GPU backend and the embedding model when a good
      connection is available, then confirm memory search turns itself back on.

### 5. Cleanup

- [ ] Remove the 16 Windows-only tests that are always skipped on Linux.
- [ ] Remove the dead locale keys that mention `setup-*.cmd` (all 50 languages).
- [ ] Replace the locale key "Windows did not confirm removal. Check the file and
      Recycle Bin." with Linux wording. The locale check requires every
      translation to keep the word "Windows", so this needs a new key in all 50
      languages. The other trash strings already read "trash" in English.
- [ ] Automatic update checks still query upstream `CapriChooms/CapriCore` and
      can announce Windows releases this fork cannot install. Turn them off, or
      point them at this fork.
- [ ] `CALL_CAMERA_FILES` still names the Windows camera host (`.exe`, `.dll`).
- [ ] Tray balloons are off on Linux (`platformFeatures.trayBalloons`), so the
      update notice in `showUpdateTrayNotice` never shows. Once update checks
      point at this fork, send it as a desktop notification (Electron's
      `Notification`, which uses `org.freedesktop.Notifications`).

## Later: features not ported yet

Each of these reports "not available on Linux yet". The mechanism planned for
each is in the heritage doc.

| Feature                                  | Planned Linux mechanism                                       | Heritage section                                                                                      |
| ---------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Spotify, YouTube Music, music awareness  | MPRIS over D-Bus                                              | [Media and music](windows-heritage.md#media-and-music--p1)                                            |
| Call audio, system-audio music detection | PipeWire null sink and monitor source                         | [Audio capture](windows-heritage.md#audio-capture-and-call-routing--p1)                               |
| Screen observation                       | `grim`/wlr-screencopy on wlroots, ScreenCast portal elsewhere | [Screen capture](windows-heritage.md#screen-capture--p1)                                              |
| CPU/GPU load control                     | cgroup v2 `CPUQuota` via a `systemd-run --user` scope         | [Load reservation](windows-heritage.md#cpugpu-load-reservation--p1)                                   |
| User tool sandbox                        | bubblewrap                                                    | [Tool sandbox](windows-heritage.md#tool-sandbox--p1)                                                  |
| App awareness events                     | `ext-idle-notify-v1` and `zwlr_foreign_toplevel_manager_v1`   | [Awareness](windows-heritage.md#awareness-events--p1)                                                 |
| Install, update, uninstall               | `.desktop` entry, XDG autostart, packaging                    | [Installer](windows-heritage.md#installer-updater-uninstaller--p1)                                    |
| Computer control, task recording         | RemoteDesktop portal + libei for input, AT-SPI2 for controls  | [Computer control](windows-heritage.md#computer-control-and-task-recording--p2-wayland-makes-it-hard) |
| Virtual camera                           | v4l2loopback                                                  | [Virtual camera](windows-heritage.md#virtual-camera--p2)                                              |
| NPU                                      | OpenVINO venv (setup not ported)                              | [NPU](windows-heritage.md#npu--p2)                                                                    |
