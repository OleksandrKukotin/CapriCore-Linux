# What the Windows code taught us

CapriCore-Linux removed the Windows-only code (PowerShell, C#, DirectShow C++,
`.cmd` launchers and the Windows installer/updater) in the `linux/remove-windows`
branch. This page keeps what was worth keeping: the design rules those helpers
encoded, and the Linux mechanism that replaces each one.

Every original file is still in git history. Recover any of them with:

```sh
git show c50c646:<path>              # e.g. git show c50c646:apps/desktop/native/tool-sandbox.cs
git ls-tree -r --name-only c50c646 | grep -E '\.(ps1|cs|cmd|cpp)$'
```

The order of upcoming work is in the [Linux roadmap](roadmap.md).

Priorities: **P0** blocks a Linux feature that users already expect,
**P1** restores a shipped Windows feature, **P2** is nice to have.

## Cross-cutting rules (apply everywhere)

These rules repeat across almost every helper. They are the real heritage.

1. **Verify identity before acting.** A PID is checked together with its start
   time before it is signalled (`stop-windows-process.ps1`). A window title is
   never trusted on its own: YouTube Music control proved the page's HTTPS
   origin first, then used the address bar only to corroborate it
   (`youtube-music.cs`). Spotify search results had to match the query before
   Play was pressed (`SpotifyBridge.cs`).
2. **The owner's input always wins.** Every automation helper polled
   `GetAsyncKeyState` and aborted when the user touched the mouse or keyboard,
   and Escape cancelled computer control. Keep a visible indicator while
   automation runs.
3. **Children die with their owner.** Helpers read a private pipe from the
   desktop; EOF (owner exit or crash) cancels the work. Job Objects killed the
   whole process tree on close. Nothing may outlive Capri.
4. **Metadata, not content.** The awareness hook emitted event names only: no
   screenshots, titles, document text or audio (`WindowsEvents.cs`). Errors
   never contain titles, coordinates or pixels (`capture-display.ps1`).
5. **Refuse filesystem links on owned paths.** Every installer, uninstaller and
   Python setup path walked its ancestors and refused reparse points before
   writing or deleting. Deletions unlink the link itself and never recurse
   through it.
6. **Preflight, then act; repairs never destroy data.** Uninstall validated
   every removal before deleting anything and removed registration last, so an
   interrupted run can be retried. A broken Python venv was _renamed_ to
   `.runtime/venv-recovery/<name>-<uuid>`, never deleted.
7. **Personal data is a separate partition.** Speech model weights and the
   user's own recordings/trained voices share a parent folder; uninstall split
   them so "remove models" can never erase recordings.
8. **Bounded everything.** Output caps (`4 MiB` counter buffers, `1 MiB`
   command lines), timeouts (`250–3500 ms` GPU probe), recording length, and
   tree walks that never enter page frames.
9. **Distinguish "empty" from "failed".** The GPU inventory returned
   `{success:false}` instead of an empty list when the probe failed, and never
   forwarded raw driver strings (they can contain machine details).

## Python runtime provisioning — P0

**Was:** `tools/setup/python-runtime.ps1`, `setup-qwen-tts.ps1`,
`setup-voice-training.ps1`, `setup-request-router.ps1`, `setup-streaming-asr.ps1`,
`setup-multilingual*.ps1`, `setup-npu.ps1`.

**Status (2026-11-26): ported, locks pending.** `packages/installer/src/python-runtime.mjs`
(interpreter, clean environment, venv recovery) and `speech-setup.mjs`
(recognition, router, voice, multilingual voice, CPU Qwen) implement the recipe
below; `installSpeechComponents` and the Qwen catalog install use them, and
`node tools/setup/setup.mjs <component>` replaces the `.cmd` launchers. Still open:

- The recognition lock (`config/asr-requirements.lock.txt`) already installs on
  Linux: it pins only portable packages without hashes, and CI installs it on
  Ubuntu and runs the ASR tests. The other locks (router, Qwen and the legacy,
  Blackwell and AMD voice locks) were compiled for Windows x64 and must be
  recompiled for `x86_64-manylinux_2_28` before those components can install.
- Accelerated Qwen (`qwen_gpu_setup.py`) pins `win_amd64` wheels, so CUDA/ROCm
  Qwen reports `CAPRI_PLATFORM_UNAVAILABLE`.
- `setup-npu.ps1` (OpenVINO venv) is not ported.
- Owner-death: the Windows `owned-speech.ps1` killed setup when Capri died.
  `runCommand` kills the process group on cancel, but a crashed Capri leaves it
  running (rule 3). `setpriv --pdeathsig` signals only the process it is set
  on, so run a watchdog under it that kills the whole setup process group
  (`kill -TERM -<pgid>`) when Capri dies.
- `config/speech-storage.json` sizes are Windows measurements; re-measure.

The recipe (platform-neutral, port it to Node or shell):

- A private `uv` in `.runtime/uv/`; restore it with `tools/setup/ensure-uv.mjs`
  when missing.
- Pinned CPython (`3.11.17`, or `3.12.12` for ROCm) installed by uv into
  `.runtime/python`, with `UV_PYTHON_PREFERENCE=only-managed`, `UV_NO_CONFIG=1`,
  `UV_PYTHON_INSTALL_REGISTRY=0` and a private `UV_CACHE_DIR`/`TMP`. Verify the
  interpreter by running `python --version`; never parse `uv python find`.
- Unset `OPENSSL_ia32cap` (uv's AWS-LC aborts on an inherited CPU mask).
- Clear every user index override (`UV_INDEX`, `UV_EXTRA_INDEX_URL`,
  `UV_INDEX_URL`, `UV_DEFAULT_INDEX`, `UV_FIND_LINKS`, `UV_NO_INDEX`,
  `UV_INDEX_STRATEGY`, `UV_TORCH_BACKEND`, `UV_OVERRIDE`, `UV_CONSTRAINT`,
  `UV_BUILD_CONSTRAINT`) so they cannot shadow pinned public sources.
- One venv per component under `.runtime/`: `asr-venv`, `router-venv`,
  `voice-training-venv`, `qwen-tts-venv`, `qwen-tts-cuda-venv`,
  `qwen-tts-rocm-venv`, `npu-openvino`. Reuse a venv only if its Python series
  matches.
- Install with `uv pip sync <lock> --require-hashes --default-index
https://pypi.org/simple --index-strategy first-index --no-config`, through
  `tools/setup/uv-retry.py` for network retries. `--torch-backend cpu|cu128`
  picks the PyTorch build.
- Report progress as JSON lines on stdout: `{"stage":"python"}`,
  `"dependencies"`, `"verify"`, `"ready"`.
- Verify by importing the stack (for example
  `from qwen_tts import Qwen3TTSModel; import torch`).

**Linux:** the venv layout is `bin/python`, not `Scripts/python.exe`. ROCm on
Linux uses the official `--torch-backend rocm*` wheels; the Windows 11/Adrenalin
check does not apply. `tools/setup/select-voice-runtime.py` and the Python
`integrations/voice_runtime/*` modules already exist and are reused as-is.

## Hardware probing and memory budgets — P0

**Was:** `packages/installer/windows/gpu-inventory.{cs,ps1}`,
`memory-budget.ps1`, `packages/runtime/src/hardware/windows-gpu.{cs,mjs}`.

- Inventory per adapter: vendor ID, dedicated VRAM, dedicated system memory,
  and whether it is UMA (integrated). Dedicated _usage_ came from the
  `\GPU Adapter Memory(*)\Dedicated Usage` performance counter.
- Use pointer-sized fields for memory (a 32-bit field truncates 8/16 GiB cards).
- Treat shared/UMA memory as RAM, never as VRAM.
- The memory budget sums `[low, high]` ranges from `config/memory-estimates.json`
  (base, language model on CPU or GPU, recognition English/multilingual,
  router, voice). When free VRAM after the model is below
  `voiceDecoderPromotionGiB`, the voice decoder falls back to the CPU.

**Linux (amdgpu / i915 / xe / nouveau via sysfs, NVIDIA via nvidia-smi):**

| Fact                              | Source                                                                                                                                   |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| vendor / device                   | `/sys/class/drm/card*/device/{vendor,device}`                                                                                            |
| VRAM total / used                 | `/sys/class/drm/card*/device/mem_info_vram_{total,used}` (amdgpu)                                                                        |
| UMA / GTT size                    | `mem_info_gtt_{total,used}`; a small `vram_total` (≤ 2 GiB) with a large GTT means an APU, like the Vega iGPU this port was developed on |
| GPU busy %                        | `/sys/class/drm/card*/device/gpu_busy_percent` (amdgpu)                                                                                  |
| per-process GPU use               | `/proc/<pid>/fdinfo/*` `drm-engine-*`, `drm-memory-*` keys                                                                               |
| NVIDIA                            | `nvidia-smi --query-gpu=name,memory.total,memory.used,utilization.gpu --format=csv,noheader,nounits`                                     |
| Vulkan view (what llama.cpp sees) | `vulkaninfo --summary`                                                                                                                   |
| temperatures                      | `/sys/class/hwmon/hwmon*/{name,temp*_input}` (`k10temp`, `amdgpu`, `coretemp`)                                                           |

## CPU/GPU load reservation — P1

**Was:** `apps/desktop/native/CapriLocalLoad.cs`, `CapriProcessLoad.cs`
(the "CPU/GPU load control" in the Local menu, default 85%).

- A _named_ Job Object with a hard CPU rate cap
  (`JOB_OBJECT_CPU_RATE_CONTROL_ENABLE | HARD_CAP`). No clock or power changes,
  no suspension, no restarts, no killing model processes.
- The desktop kept the non-inheritable handle; a reset helper restored the
  quota and closed it exactly once, even if the helper was killed.
- Load accounting walked Capri's own process tree (and its launcher/CLI
  ancestors, never their other children), summing CPU time, working set and
  per-engine GPU counters.

**Linux:** cgroup v2 through systemd, no root needed:

```sh
systemd-run --user --scope --unit=capri-llama -p CPUQuota=680% -- llama-server …
systemctl --user set-property capri-llama.scope CPUQuota=400%   # live change
```

`CPUQuota` is a percentage of one CPU (8 threads × 85% ≈ `680%`). For accounting,
read `/sys/fs/cgroup/<scope>/cpu.stat` and `memory.current`, or walk
`/proc/<pid>/task/*/children` and `/proc/<pid>/stat` (utime + stime, fields 14
and 15). There is no portable GPU cap; llama.cpp's offload (`-ngl`) remains the
GPU lever.

## Tool sandbox — P1

**Was:** `apps/desktop/native/tool-sandbox.cs` (runs approved user tools).

- Fixed launcher: no shell, an exact executable and argument vector.
- AppContainer per run (`Capri.Tool.<24 hex>`), deleted afterwards; the cleanup
  argument is validated against that pattern.
- Explicit IPv4/IPv6 network block, even when VPN/firewall setups bypass
  default isolation.
- A Job Object with kill-on-close, process and memory limits owns every
  sandboxed process.
- Owner pipe EOF terminates the script before the network block is removed.

**Linux:** `bubblewrap` (unprivileged):

```sh
bwrap --die-with-parent --unshare-all --new-session \
      --ro-bind /usr /usr --symlink usr/lib /lib --symlink usr/bin /bin \
      --proc /proc --dev /dev --tmpfs /tmp \
      --bind "$WORKDIR" /work --chdir /work -- /usr/bin/python3 tool.py
```

`--unshare-all` includes the network namespace (no network at all). Add memory
and process limits with `systemd-run --user --scope -p MemoryMax=… -p TasksMax=…`
around `bwrap`. Landlock is an option for finer file rules.

## llama.cpp runtime views — P2

**Was:** `packages/runtime/src/host/llama-bundle.mjs` and the illegal-instruction
retry in `llama-workers.mjs` (removed in this branch).

- Before starting a CPU-only worker, Capri hard-linked the llama.cpp bundle into a
  scratch "view" **without** `ggml-vulkan.dll`, so a broken GPU driver could not be
  loaded at all (llama.cpp scans its own directory for backend plugins).
- If a worker died with an illegal CPU instruction (`0xC000001D`), Capri retried
  once with a view containing only the baseline `ggml-cpu-x64` backend.

**Linux:** release bundles load `libggml-*.so` backends dynamically. The same views
work with hard links of the `.so` files; detect the crash as `signal === 'SIGILL'`.
Until then, `-ngl 0` / `--device none` covers CPU-only runs, and llama.cpp picks a
CPU variant the processor supports.

## Native helpers built on demand — keep the pattern

Every C# helper was compiled lazily from source at first use, cached under
`.runtime/<helper>/<source-hash>/`, and accepted only if a `build.json` receipt
matched both the source hash and the executable's hash. A modified binary was never
"blessed" by a later source change. Use the same receipt rule for any Linux helper
(Rust or C) that ships as source.

## Process lifecycle — done on Linux, keep the rules

**Was:** `packages/runtime/src/host/stop-windows-process.ps1`.

The PID must match the recorded start time; the handle is held for the whole
wait; graceful stop writes a stop file, forced stop terminates; a timeout
throws and keeps the process marker. `packages/runtime/src/host/processes.mjs`
already does the POSIX side (start time from `/proc/<pid>/stat` field 22,
detached children, signals). Upgrade path: `pidfd_open` +
`pidfd_send_signal` pins identity without the start-time race, and
`PR_SET_PDEATHSIG` gives children the "die with owner" rule.

## Awareness events — P1

**Was:** `integrations/awareness/native/WindowsEvents.cs`,
`apps/desktop/windows-observer.mjs`.

Events emitted: `app.foreground`, `browser.tab-changed`, `power.suspend`,
`power.resume`, `session.lock`, `session.unlock`, `session.ending`, plus idle
time from `GetLastInputInfo`.

**Linux:**

| Event            | Source                                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------- |
| suspend / resume | logind D-Bus `org.freedesktop.login1.Manager.PrepareForSleep(bool)`                         |
| shutdown         | `PrepareForShutdown(bool)`; take a delay inhibitor to flush state                           |
| lock / unlock    | `org.freedesktop.login1.Session` `Lock`/`Unlock` signals, `LockedHint`                      |
| idle             | Wayland `ext-idle-notify-v1` (labwc, KDE, Hyprland, Sway)                                   |
| foreground app   | `zwlr_foreign_toplevel_manager_v1` (`app_id`, `title`, `activated`); no geometry on Wayland |
| browser tab      | MPRIS metadata from the browser, or the window title as a hint only                         |

## Media and music — P1

**Was:** `integrations/perception/native/MediaPlayback.cs` (system media
transport controls), `integrations/spotify/native/*` (UI Automation),
`SpotifyAudio.cs` (per-session volume), `apps/desktop/native/youtube-music.cs`.

Kept rules: identify the app by stable ID, not window title; verify the
current track after an action instead of assuming it worked; never use a stale
library "Play" button as a search result; adjust only the app's own audio
session, never the master volume.

**Linux:** MPRIS over D-Bus replaces nearly all of it, with no UI scraping:

- Players: `org.mpris.MediaPlayer2.*` names (`spotify`, `firefox.instance…`,
  `chromium.instance…`).
- Read `Metadata`, `PlaybackStatus`, `Position`; call `PlayPause`, `Next`,
  `Previous`, `OpenUri`.
- Spotify search/play: `OpenUri("spotify:search:<query>")` or a track URI.
- Per-app volume: PipeWire stream nodes (`wpctl status`, `wpctl set-volume <id> 0.6`).
- Browser players (YouTube Music) expose MPRIS through the browser's media
  session.

## Audio capture and call routing — P1

**Was:** `apps/desktop/native/audio-endpoints.cs` (WASAPI capture/loopback),
`apps/desktop/windows-audio-endpoints.mjs`,
`integrations/call-audio/CableDefaults.cs`.

- 16 kHz mono packets to the parent over a pipe; parent death closes the pipe.
- An idle playback endpoint sends no packets, so the helper advanced the
  detector clock with silence. Otherwise a stopped track never reads as "idle".
- Installing a virtual cable makes Windows switch defaults; the helper saved
  and restored the user's default endpoints.

**Linux:** PipeWire, no driver install:

```sh
pw-record --target <sink>.monitor --rate 16000 --channels 1 --format s16 -   # loopback
pactl load-module module-null-sink sink_name=capri_call                       # virtual cable
wpctl inspect @DEFAULT_AUDIO_SINK@                                            # save/restore defaults
```

Keep the silence-clock rule: a monitor source of an idle sink also goes quiet.

## Computer control and task recording — P2 (Wayland makes it hard)

**Was:** `integrations/desktop-actions/native/DesktopActions.cs` (2.2k lines),
`apps/desktop/native/task-recorder.cs`, the Discord/Opera/editor fixtures.

Hit-testing rules learned the hard way (all still relevant to AT-SPI):

- Confirm the element under the point belongs to the intended window before
  clicking (`WindowFromPoint` + ancestor check).
- Windows 11 taskbar hit tests can resolve to the XAML container; accept only
  the observed button's ancestor.
- Some renderers report the top-level surface for every hit; accept the
  fallback only for an exact owner-requested left click on a label inside a
  tight box.
- Click-through overlays can be returned by accessibility hit tests even when
  the native window check disagrees; the native check wins.
- Per-monitor DPI awareness before any coordinate math.
- The recorder's hook callbacks only enqueue events; accessibility lookups run
  on a worker. Recording is explicit, bounded and owner-started.

**Linux:** input through the RemoteDesktop portal + libei (asks the user once);
`ydotool` (uinput) as a fallback that needs device access. Accessibility tree
through AT-SPI2 (`pyatspi`/`atspi`). Screen through the ScreenCast portal, or
`wlr-screencopy` (`grim`) on wlroots compositors such as labwc. Global input
recording is not possible on Wayland without a portal; plan for that.

## Screen capture — P1

**Was:** `integrations/perception/native/capture-display.ps1`
(`PrintWindow(PW_CLIENTONLY | PW_RENDERFULLCONTENT)` for Chromium windows).

**Linux:** `grim` / `wlr-screencopy` on wlroots, the ScreenCast portal
elsewhere. Electron's `desktopCapturer` uses the portal automatically.

## Virtual camera — P2

**Was:** `apps/desktop/native/camera/*` (a DirectShow source filter + host),
built by `tools/release/build-camera.mjs`.

**Linux:** `v4l2loopback` kernel module (`modprobe v4l2loopback
card_label="Capri" exclusive_caps=1`), then write frames to `/dev/videoN`; or a
PipeWire video source node. The JS protocol `apps/desktop/call-camera-protocol.mjs`
is platform-neutral and kept.

## Installer, updater, uninstaller — P1

**Was:** `packages/installer/windows/*` (WinForms wizard, 12k lines),
`packages/updater/windows/*`, `Install Capri.cmd`.

Ideas to keep (the JS engines in `packages/installer/src` and
`packages/updater/src` stay; only the Windows shells were removed):

- **Storage estimate** with a clean-install reserve: the network estimate may
  reuse cached files, but setup still needs space for repair, staging and
  extraction. Count only the Electron cache archive (`npm ci` replaces the
  unpacked bundle).
- **Memory budget** shown before downloading (see above).
- **Recovery sessions**: one session folder per run with a worker lease, so a
  crashed wizard can be resumed or cleaned up.
- **Diagnostics export** as a redacted ZIP (`apps/desktop/diagnostics/*`
  already implements redaction).
- **Uninstall order**: preflight every removal → remove files → registration
  and the recovery launcher last.
- **Language-aware model recommendations** (`model-language-recommendations.ps1`
  read `config/model-language-benchmark.json`).

**Linux packaging:** a `.desktop` entry (`~/.local/share/applications`), XDG
autostart (`~/.config/autostart`), a StatusNotifierItem tray icon (Electron's
`Tray` uses it), and later AppImage or Flatpak.

## Desktop integration — P2

**Was:** `shell-link.cs` and `register.ps1` (Start-menu shortcuts and an
AppUserModelID for taskbar grouping), `desktop-branding.cs`,
`desktop-teleport.cs`, `display.cs` (DPI), `tray-only-windows.mjs` (keep
companion windows out of the taskbar).

**Linux:** `StartupWMClass` in the `.desktop` file groups windows; layer-shell
surfaces (the Rust overlay in `apps/overlay`) never appear in the taskbar;
Wayland handles scaling per output (`wl_surface.preferred_buffer_scale`,
`wp-fractional-scale-v1`).

## NPU — P2

**Was:** `tools/setup/setup-npu.ps1` (OpenVINO for Intel NPU).
`integrations/npu/worker.py` is platform-neutral and kept.

**Linux:** Intel NPU needs the `intel_vpu` kernel driver and the
`intel-npu-driver` user-space stack; AMD Ryzen AI NPUs use `amdxdna`.
OpenVINO supports Linux directly.
