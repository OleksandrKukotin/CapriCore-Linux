# Capri — Product Roadmap (Linux)

Updated 2026-11-27 for **CapriCore-Linux**, based on upstream Capri 1.2.2.

This page says what Capri should become and how far each part is on Linux. The
order of the next few tasks is in the [Linux roadmap](docs/linux/roadmap.md).
The Linux mechanism planned for each Windows-era feature is in
[Windows heritage](docs/linux/windows-heritage.md).

The epics keep their upstream `CAP-xx` numbers so older notes still resolve.
Upstream's Windows plan (installer, updater, signing, DirectML, Windows ML,
UI Automation) was dropped; its ideas are restated here for Linux where they
still apply. The original is in git history: `git show e0a23ed:ROADMAP.md`.

Capri is a Linux desktop companion with expressive speech and animation, shared
conversation and memory across supported interfaces, and user-controlled access
to desktop actions.

**How to read the checkboxes.** `[x]` means the code exists and runs on Linux
(not necessarily checked on every setup). `[ ]` means open. **Needs a Linux
backend** marks platform-neutral code whose OS side was a Windows helper; it
reports "not available on Linux yet" until the backend in the heritage doc
exists.

## Where Capri stands on Linux

- **Desktop.** The Electron companion opens on Wayland (developed on sway) with
  animation, teleports, mouth layers, dialogue, compact controls, tray and
  resource monitoring. It moves by its header; its transparent area still
  catches clicks, and resizing, roaming and teleports are off on Wayland. A
  native layer-shell overlay is in [`apps/overlay`](apps/overlay).
  The interface has 50 offline languages.
- **Inference and memory.** Local models through a system `llama-server`,
  Hugging Face GGUF imports, saved OpenAI-compatible API profiles, and the
  [Claude Code bridge](README.md#chat-through-claude-code-no-model-download).
  Memory recall needs `llama-server` plus the embedding model; without them it
  is switched off. Ordinary history and memory are not encrypted.
- **Speech.** Setup is ported to Node with a uv-managed Python per component.
  The recognition lock installs on Linux (CI proves it). The voice, router and
  Qwen locks are still Windows builds, so voice does not install yet.
- **Perception and actions.** Scoped file tools work. Screen capture, app
  awareness, app actions, computer control, recorded workflows, Spotify, call
  audio, the virtual camera and sandboxed user tools need a Linux backend.
- **Distribution.** Runs from source only: `npm ci`, `npm run setup`,
  `npm run desktop`. No packages, installer or in-app updater. CI runs on Ubuntu.

## Priorities

- **P0 — Foundation:** needed for a reliable everyday Linux setup.
- **P1 — Core improvement:** the next user-facing capabilities.
- **P2 — Expansion:** after dependencies and quality checks are ready.

| Order         | Deliverable                                                                                                                                                                                                                                                                                                                                 | Exit condition                                                                                                                     |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Now · P0      | Finish the port basics: fast Claude Code chat, a usable Wayland window, installable speech locks, memory recall. [Linux roadmap](docs/linux/roadmap.md)                                                                                                                                                                                     | Chat, voice and recall work on the development machine from a clean checkout.                                                      |
| Next · P0     | Measure long-chat stalls and move routine compaction out of the reply path. [CAP-07](#cap-07--measured-performance-improvements--ongoing-p0) · [CAP-12A](#cap-12a--responsive-context-compaction--p0)                                                                                                                                       | Local and API chat survive context pressure. Timings separate compaction from provider wait. History survives cancellation.        |
| Then · P1     | Restore the Windows-era features with Linux backends, most-used first: media, screen capture, awareness, load control. [CAP-03](#cap-03--scoped-file-and-application-actions--p1) · [CAP-04](#cap-04--contextual-awareness-and-proactive-conversation--p1) · [CAP-05](#cap-05--optional-screen-and-webcam-perception--p1-screen--p2-webcam) | Each restored feature passes its own capability and privacy checks on wlroots, and its gap on GNOME/KDE is documented.             |
| Then · P1     | Budgeted recall with free-form tags and memory controls. [CAP-12B](#cap-12b--tagged-long-term-memory--p1)                                                                                                                                                                                                                                   | Capri retrieves the right fact from a crowded category within a fixed prompt budget, with local indexing and per-provider sharing. |
| Parallel · P0 | Make installing, updating and removing Capri on Linux ordinary. [CAP-14](#cap-14--public-repository-and-distribution--p0) · [CAP-15](#cap-15--install-and-first-run--p0) · [CAP-16](#cap-16--updates-recovery-and-removal--p0)                                                                                                              | Install, first conversation, update and removal pass on a clean supported distribution without editing JSON.                       |
| Later · P2    | Computer control, webcam, more speech backends, remote channels. [CAP-06A](#cap-06a--gpu-cpu-and-npu-voice-backends--p2) · [CAP-13](#cap-13--telegram-parity--p2)                                                                                                                                                                           | Each advertised device, workflow and channel passes its own checks.                                                                |

No item implies support for every compositor, GPU or language. Each advertised
combination needs its own evidence.

## CAP-01 — Optional voice effects · P1

Configurable post-processing on voice playback. The DSP is platform-neutral
JavaScript; it becomes usable on Linux once a voice installs (see the speech
locks in the [Linux roadmap](docs/linux/roadmap.md#3-speech)).

- [x] A clean preset plus subtle cybernetic, radio and holographic presets.
- [x] Independent intensity, dry/wet, reverb, delay, filtering and glitch frequency.
- [x] Short, sparse glitches that keep words understandable.
- [x] Continuous processing across streamed chunks: no clicks, cut tails, clipping or overlapping replies.
- [x] Effects apply to playback only; samples, training data and exported voices stay unchanged.
- [x] Preview, bypass and reset; turning effects off restores clean playback immediately.
- [x] Kept separate from animation effects and any future microphone effects.
- [ ] Listening check on Linux audio (PipeWire): headphones and speakers, added latency and CPU cost.

[Details and measurements](docs/voice-effects.md)

**Done when:** clean playback matches the plain voice, presets pass listening
checks, cancellation is immediate, and latency and CPU cost are measured.
Effects stay off until the user picks a preset.

## CAP-02 — Independent language settings and validated speech packs · P2

- [x] Separate interface, conversation, recognition and voice languages, with a "use conversation language" option.
- [x] Installed language/voice packs with compatibility metadata.
- [x] Changing recognition models keeps the microphone choice and shared context.
- [x] Per-language voice choices are remembered; switching needs no reinstall or memory reset.
- [ ] Recognition on a real Linux machine: European languages on Parakeet, the wider set on CPU Whisper. CI installs the lock and runs the ASR tests; a live microphone test is still open.
- [ ] English stays the quality reference. Pick the next language deliberately and validate it before expanding.
- [ ] Per-language checks: intelligibility, naturalness, pronunciation, character similarity, emotion and latency, with blind comparisons and held-out audio.
- [ ] Test accents, pauses, noise, names, song titles, dates, numbers and mixed-language phrases.
- [ ] Optional automatic language detection; users can lock a language. Never silently fall back to a worse voice or language.
- [ ] Localize character instructions, output cleaning, tools and the request classifier where needed. Unsupported classifier languages keep the ordinary path.

[Languages](docs/languages.md) · [Interface localization](docs/localization.md)

**Done when:** each advertised language/voice combination passes its documented
quality checks. Multilingual support is not a claim of equal quality.

## CAP-03 — Scoped file and application actions · P1

File tools are pure Node and work on Linux. App actions, Discord desktop
control and computer control drove Windows UI and need a Linux backend:
AT-SPI2 for controls and the RemoteDesktop portal with libei for input
([heritage](docs/linux/windows-heritage.md#computer-control-and-task-recording--p2-wayland-makes-it-hard)).

- [x] Typed tools to list, find, read, create, copy, move and rename regular files in granted scopes.
- [x] Scopes grow only through explicit user choices. Real paths are resolved; links, name collisions and changed destinations are handled. Protected locations cover system trees and per-user credentials.
- [x] Deletion goes to the trash (`shell.trashItem`, which uses the freedesktop trash on Linux) with a private recovery copy and an operation journal.
- [x] Results are verified before success is reported; operation IDs stop retries from duplicating changes.
- [ ] Say "trash" instead of "Recycle Bin" in replies, prompts and locale strings, and drop "Windows did not confirm removal".
- [ ] Directory and cross-filesystem operations with rollback and partial failures. Moves across filesystems are refused today.
- [ ] Network and FUSE mounts (NFS, SMB, gvfs): define what is allowed and test it.
- [ ] Prefer file and application APIs. Use AT-SPI2 for supported controls, with screenshots and coordinates only as a limited fallback. **Needs a Linux backend.**
- [ ] Start app control small: launch or focus an app, find a control, type text, one bounded action. Mark supported and experimental integrations. App launching can use `.desktop` entries (`gtk-launch`, `gio launch`).
- [ ] A short action preview when useful. Confirm destructive, bulk or sensitive actions; reusable grants only for routine low-impact ones.
- [ ] Stop control and Escape across long action chains, including focus loss, late tool results and partial work. On Wayland, Electron's global Escape (`globalShortcut`) gets no keys; bind a compositor key to the companion CLI's `stop` action ([CAP-11](#cap-11--unified-settings-and-capability-controls--p0)) or use the GlobalShortcuts portal.
- [ ] File contents, window text, websites and screenshots are untrusted data. They never grant permissions.

[File actions](docs/file-actions.md) · [Application access](docs/application-actions.md) · [Computer control](docs/computer-control.md)

**Done when:** supported workflows pass tests with real applications and
failure cases. Capri reports partial work honestly and never claims success
without evidence.

## CAP-04 — Contextual awareness and proactive conversation · P1

The initiative logic (levels, cooldowns, generation, dismissal) is
platform-neutral and kept. Its event source was a Windows hook, so on Linux
Capri currently has nothing to react to. **Needs a Linux backend.**

Planned sources: `ext-idle-notify-v1` for idle/return,
`zwlr_foreign_toplevel_manager_v1` for app and fullscreen changes on wlroots,
systemd-logind for lock/unlock, sleep and shutdown, and MPRIS for media.
GNOME and KDE do not expose foreign-toplevel; document that gap.

- [ ] An event pipeline for app/window changes, media, idle/return, lock/unlock, sleep/resume and shutdown. **Needs a Linux backend.**
- [x] Prefer events over sending screenshots. Use vision only when an event needs it and permission exists.
- [x] Observation, interpretation, deciding to speak and writing the line are separate steps. Events carry a timestamp, source and confidence.
- [x] Opt-in initiative levels (off, occasional, conversational), quiet hours, cooldowns, per-app exclusions and a frequency limit.
- [x] The user can dismiss a comment and turn that kind of initiative down without clearing the conversation.
- [ ] Stay quiet during games, fullscreen media, calls, presentations, quiet mode and active speech unless allowed.
- [ ] User messages beat generated observations. Drop stale comments.
- [ ] Use the current character, language and memory; avoid repeated catchphrases and claims of seeing content without perception access.
- [ ] An optional short goodbye at shutdown. Take a logind delay inhibitor only if a line is already prepared, release it within a few seconds, and never wait for a model or voice synthesis.
- [ ] Metadata only: event names, never window titles, screenshots or audio (heritage rule 4).

**Example:** a verified media-open event (MPRIS) may lead to "We watching
this?" when the user enabled it. A filename alone does not say what a video is.

[Initiative](docs/initiative.md)

**Done when:** recorded test events give timely, varied and fitting reactions;
quiet modes and priority rules hold; no proactive task changes files, music or
settings without separate permission.

## CAP-05 — Optional screen and webcam perception · P1 screen / P2 webcam

The picker, preview, question flow, bounded observation leases, change
detection, revocation and provenance handling are platform-neutral and kept.
The frame source was Windows-only. **Needs a Linux backend:** wlr-screencopy
(`grim`) on wlroots, the ScreenCast portal elsewhere.

- [ ] A Linux frame source for one-shot and bounded observation. Reuse the portal's own picker where the compositor requires it.
- [x] Explicit choices: one-shot screenshot, selected window or monitor, bounded continuous mode.
- [x] Capture time and source travel with each observation; stale or unreadable images are reported as such.
- [x] Frames are ephemeral by default; saving needs a separate choice.
- [x] Observations enter the conversation with provenance, kept apart from instructions and permissions.
- [x] Hide, lock, suspend and source loss revoke access without auto-resume.
- [ ] Separate screen and webcam permissions, both off by default, with visible indicators and immediate stop.
- [ ] Webcam selection and preview through PipeWire or V4L2, without recording audio or images just to preview.
- [ ] Cropping, exclusions, rate limits and a vision profile that fits available resources.
- [ ] Event-driven visual initiative, after CAP-04 has an event source.

[Snapshot](docs/screen-snapshot.md) · [Observation](docs/screen-observation.md)

**Done when:** the chosen source, the indicator, the real capture and the
model's claims agree; stop releases access; disabled perception never slows
text or voice chat.

## CAP-06 — Hardware profiles, lower VRAM and game mode · P0 baseline, P2 broad coverage

Hardware probing is ported: DRM sysfs for AMD/Intel, `nvidia-smi` for NVIDIA,
hwmon temperatures, `/proc` process load. Shared GTT memory on an APU counts as
RAM, not VRAM. Setup offers minimal, balanced, desktop and quality profiles.

- [x] Detect GPU, VRAM, RAM and CPU. Keep a manual profile override.
- [ ] Detect usable compute backends (Vulkan, CUDA, ROCm) and free disk space, and explain a missing driver separately from an unsupported device.
- [ ] Profiles with tested descriptions of quality, features and resource use.
- [ ] Measure combined peak use of LLM, voice, vision, context and other services, with a safety margin. Re-measure `config/memory-estimates.json` and `config/speech-storage.json` on Linux.
- [ ] Evaluate smaller or quantized text models for character, tool use, memory, plain text, avatar protocol and latency.
- [ ] Keep recognition and classification on CPU where it helps; document the CPU fallback and its limits.
- [ ] Load vision and voice on demand and unload after configurable inactivity.
- [ ] Game mode: stop observation and initiative, unload owned GPU models, show when done and restore on request. Consider starting it automatically while Feral GameMode (`gamemoded`) is active.
- [ ] Recover from out-of-memory errors with an explained fallback. Never silently lower voice quality or kill unrelated processes.
- [ ] CPU/GPU load control (was a Windows Job Object): a cgroup v2 `CPUQuota` through a `systemd-run --user` scope. **Needs a Linux backend.** [Heritage](docs/linux/windows-heritage.md#cpugpu-load-reservation--p1)

[Hardware](docs/hardware.md) · [Load control](docs/local-model-load.md)

**Done when:** each profile has a tested minimum configuration and measured
peak memory; switching keeps history and settings; game mode really frees what
it claims to.

### CAP-06A — GPU, CPU and NPU voice backends · P2

Shares the speech adapter contract with [CAP-17](#cap-17--hugging-face-model-and-voice-library--p1-foundation-p2-expansion).
CAP-06A owns device execution and preserving the trained Capri voice; CAP-17
supplies Hub packages, other model families and per-language selection.

**State on Linux.** Chatterbox voice needs the CUDA or ROCm voice locks
recompiled for `x86_64-manylinux_2_28`. Accelerated Qwen pins `win_amd64`
wheels and reports unavailable. The Qwen3-TTS CPU beta needs its lock
recompiled. The NPU (OpenVINO) setup is not ported. Linux helps here: ROCm and
CUDA are first-class on Linux, and PyTorch ships official ROCm wheels.

**Preserve the voice first.** The English voice is the pinned Chatterbox Turbo
base plus Capri's trained adapter and reference. Resemble AI publishes a
[Chatterbox Turbo ONNX model](https://huggingface.co/ResembleAI/chatterbox-turbo-ONNX);
it shows an ONNX route exists, not that our adapter exports as-is. Check base
revision, tokenizer and preprocessing, merge the adapter into the matching base
and export that exact voice. Never replace the trained voice with stock
reference cloning and advertise the same result. The English export says
nothing about the multilingual model.

| Route                        | Role                                           | Constraints                                                                                                                                               |
| ---------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PyTorch CUDA                 | Baseline on NVIDIA                             | Recompile the lock for Linux. Keep NVIDIA architecture checks scoped to NVIDIA.                                                                           |
| PyTorch ROCm                 | AMD GPUs                                       | Use a GPU/driver/ROCm combination from AMD's support matrix and a separate pinned venv. Integrated GPUs are often outside the matrix; test, never assume. |
| PyTorch CPU                  | Reference path and fallback without GPU speech | Generalize the whole voice path, not only the decoder. Benchmark first; same weights do not mean real time on every CPU.                                  |
| ONNX Runtime (CPU, then GPU) | Portable export of the merged voice            | Check opset, operators, cache tensors and dynamic shapes per execution provider.                                                                          |
| OpenVINO / AMD XDNA          | Intel and AMD Ryzen AI NPU prototypes          | Driver and runtime support on Linux varies by kernel and device. No universal NPU backend or guaranteed full placement.                                   |

**Implementation sequence**

- [ ] A provider-independent speech contract: probe, load, warm up, synthesize/cancel, health, memory and unload. Token generation and audio decoding placeable independently, with capabilities per stage.
- [ ] Replace hard-coded `cuda:0`, unconditional CUDA synchronization and graphs, NVIDIA-only memory queries and install-time vendor gates with backend adapters. PyTorch HIP exposes the `torch.cuda` namespace; tell runtimes apart by backend metadata.
- [ ] A complete CPU reference path compared against the FP32 baseline, with capped threads so speech does not starve recognition, routing or the LLM.
- [ ] ROCm synthesis on one supported AMD configuration, then a second device class, in an isolated venv. Never replace the NVIDIA environment or relax dependency/TLS checks globally.
- [ ] Reproduce the official ONNX pipeline on CPU, then export the exact merged Capri voice. Validate layouts, special tokens, conditioning, cache lifecycle, text length, cancellation and phrase boundaries. Publish converted weights as hashed, versioned assets outside the repository.
- [ ] Do not label synthesis GPU-accelerated when most work falls back to CPU.
- [ ] NPU feasibility per stage: fixed or bucketed shapes, persistent cache inputs, operator coverage, then quantization against an FP32/FP16 reference. Measure compile and transfer cost.
- [ ] Setup detects text, recognition and voice capability separately and distinguishes missing driver, missing runtime, unsupported device and insufficient memory. Download only the selected environment. CPU or different-voice fallback is explicit.
- [ ] Qualify multilingual speech separately after the English voice.

**Qualification**

- [ ] Measure cold/warm first playable audio, real-time factor, p50/p95, peak host and device memory, provider partitioning and contention with the LLM and recognition.
- [ ] Compare the same held-out English sentences against NVIDIA FP32 with blind listening and transcription checks. Do not assume INT8/INT4 keeps the voice.
- [ ] Test install, repair, missing or wrong drivers, cancellation, OOM, device loss, repeated load/unload and game-mode release on each advertised hardware family.
- [ ] Record exact device, distribution, kernel, driver, runtime versions, model revision, adapter/reference hashes and export settings. Track experimental, verified and unsupported combinations separately.
- [ ] Review redistribution licenses for runtime packages and converted model assets before shipping them.

References: [AMD ROCm compatibility matrix](https://rocm-handbook.amd.com/projects/amd-rocm-programming-guide/en/latest/compatibility/compatibility-matrix.html),
[PyTorch HIP semantics](https://docs.pytorch.org/docs/stable/notes/hip.html),
[ONNX Runtime execution providers](https://onnxruntime.ai/docs/execution-providers/).
Recheck matrices when choosing pins; rolling documentation is not a Capri promise.

[AMD voice requirements](docs/amd-voice.md) · [Voice GPU compatibility](docs/voice-gpu-compatibility.md)

## CAP-07 — Measured performance improvements · ongoing P0

- [ ] Claude Code bridge: a reply takes about 20 s. Measure CLI startup, prompt size and first token, then drop tool definitions the text-only bridge cannot use. [Linux roadmap](docs/linux/roadmap.md#1-faster-claude-code-chat)
- [ ] Long-session compaction benchmarks, with context preparation and API streaming timed separately ([CAP-12A](#cap-12a--responsive-context-compaction--p0)).
- [ ] Instrument end of speech, end-of-turn decision, final transcription, classification, prefill, first visible text, first speech request, first playable audio and playback start.
- [ ] Report text-to-response and voice-to-response separately; separate cold start, warm use, long history and tool requests.
- [ ] Track median and p95 on a repeatable set with stated hardware, context size, settings and sample count.
- [ ] Keep CPU routing with a bounded timeout and ordinary-path fallback; widen the fast path only with calibration and regression checks.
- [ ] Profile context growth, repeated instructions, cache invalidation, retrieval, serialization, queueing, GPU contention, speech buffering and first-chunk synthesis.
- [ ] Tune silence detection and speech chunking without losing natural pauses or accuracy.
- [ ] Bounded queues, cancellation, stale-result rejection and deliberate prewarming in every optional service.
- [ ] Latency budgets per hardware profile once a Linux baseline exists. A four-second warm first audio is a reference to investigate, not a promise.

[Performance](docs/performance.md)

**Done when:** changes come with comparable before/after measurements and
quality checks. Faster first text does not prove faster audible replies.

## CAP-08 — Legacy removal and repository hygiene · P0

Upstream finished its cleanup ([cleanup.md](docs/cleanup.md)). The fork then
removed the Windows code and recorded its lessons in the
[heritage doc](docs/linux/windows-heritage.md).

- [x] Inventory entry points, dependencies, configuration, scripts, models and docs; map each to a feature or developer workflow.
- [x] Retire abandoned paths and experiments after checking dynamic imports, runtime paths and setup scripts.
- [x] Keep models, environments, private data and generated reports out of the repository.
- [x] Remove PowerShell, C#, DirectShow and `.cmd` sources, the Windows installer and updater.
- [ ] Remove the Windows-only tests that are always skipped on Linux.
- [ ] Remove dead locale keys that mention `setup-*.cmd` (all 50 languages).
- [ ] Remove or repoint upstream links and the private-repository token flow (`community-links.mjs`, `github-access.mjs`).
- [ ] Rename Windows-flavoured wording that survives in code and docs: Recycle Bin, drives, `.exe`/`.dll` names in `CALL_CAMERA_FILES`.
- [ ] Rename the `ollama*` settings and URLs that now point at the managed llama.cpp host, with a settings migration.

**Done when:** a clean checkout holds only maintained source and essential
assets, and no message tells a Linux user about Windows.

## CAP-09 — Incremental architecture and code refactoring · P0

- [ ] Boundaries for desktop UI, conversation, OpenClaw transport, models, voice/DSP, recognition, vision, actions, initiative and persistence.
- [ ] Typed, versioned contracts for tools, events, settings and worker messages, validated at process boundaries.
- [ ] Schema-driven settings, shipped defaults separate from user overrides, versioned migrations with recovery.
- [ ] One lifecycle for optional services: start, ready, cancel, health, failure, shutdown. Failures never break basic chat.
- [ ] One capability report, so Capri only describes features that are enabled and available. Today `platformFeatures` and `platformUnavailable` do part of this; fold them into it.
- [ ] Shrink large orchestration files in small behavior-preserving steps. `apps/desktop/main.mjs` is about 10,000 lines.
- [ ] Document pinned upstream patches (`patch-openclaw.mjs`), their checks and the plan to retire them.
- [ ] Formatting, linting, type checking and naming conventions; no framework replacement for its own sake.

[Refactoring notes](docs/REFACTORING.md) · [Architecture](docs/architecture.md)

**Done when:** features behave as before, module contracts and dependency
direction are documented, and every step passes its checks.

## CAP-10 — Reliability, accessibility and polish · P0

- [ ] A bug backlog with severity, reproduction, affected versions, expected behavior and regression tests.
- [ ] Test cancellation, reconnects, missing models, unavailable devices, permission denial, interrupted downloads, sleep/resume and GPU/voice failures.
- [ ] Long conversations, repeated messages, simultaneous channel input and partial tool completion without duplicate actions or stale audio.
- [ ] Wayland window behavior: only Capri's shape catches clicks and the avatar places itself again (layer-shell overlay; Electron's `setShape` does nothing on Wayland), resizing, multiple monitors, fractional scaling, fullscreen apps and off-screen recovery. The window already moves by its header. [Linux roadmap](docs/linux/roadmap.md#2-companion-window-on-wayland)
- [ ] Test at least sway and one of GNOME or KDE; record what each compositor allows.
- [ ] Readable subtitles, usable history, consistent keyboard navigation and screen-reader access where supported (AT-SPI).
- [ ] Reduced motion, independent glitch intensity, high-contrast text and separate speech/effect volume.
- [ ] Clear recovery messages and optional redacted diagnostic exports. No secrets, private prompts or screenshots in routine logs.
- [ ] No unresolved blocking bugs in the supported scope; track lower-severity issues openly.

**Done when:** normal use and recovery pass a documented checklist, and polish
does not cost usability or performance.

## CAP-11 — Unified settings and capability controls · P0

The settings panel, temporary approval cards and model-independent reminders,
timers and stopwatch exist. [Timers and settings actions](docs/timers-and-actions.md)

- [ ] One settings interface for languages, models, audio devices, voice, effects, subtitles, appearance and resource use.
- [ ] Separate controls for initiative, screen, webcam, app integration, file scopes and external channels.
- [ ] Each setting explained in plain language, including its cost in quality, latency, resources and privacy. Preview and restore-default where useful.
- [ ] A companion CLI for keyboard shortcuts and scripts: `capri.mjs desktop --action stop|toggle-mic|say "…"` hands a fixed allowlist of actions to the running instance through Electron's `second-instance` event (the single-instance lock already exists). Users bind keys in their compositor (`bindsym $mod+c exec …` on sway), which works where `globalShortcut` cannot. Add a Unix socket only if scripts need replies. The CLI never grants more than the UI does.
- [ ] Offer the same actions through the GlobalShortcuts portal on GNOME and KDE, after checking what the pinned Electron supports.
- [ ] Opt-in autostart through an XDG autostart entry (`~/.config/autostart/capri.desktop`). Nothing exists yet.
- [ ] Show whether Capri is hidden, listening, observing or using the GPU.
- [ ] One quiet/privacy switch that stops new microphone, screen and webcam capture and proactive speech, separate from muting playback.
- [ ] Say when a setting applies at once and when it needs a restart or download. Keep preferences across updates.
- [ ] Settings that cannot work on this platform say so, instead of failing when used.

**Done when:** ordinary users configure supported features without editing
JSON or using a terminal, and the UI matches real service state.

## CAP-12 — Memory management and user data · P0

**Baseline.** OpenClaw owns the shared session, keeps the original history and
summarizes active replay for local and API chat. At 32K the 24 KiB
active-transcript guard can trigger before the token ceiling. A local CPU
embedding index supports hybrid keyword and semantic search through
`memory_search` and `memory_get`; on Linux it needs `llama-server` and the
embedding model and is switched off without them. Settings show saved facts,
the Brain folder supplies local document retrieval, and a separate
password-protected memory box has its own unlock lifecycle. Ordinary history is
not encrypted. Direct Lemonade dialogue code is kept but untested on Linux.

[Architecture](docs/architecture.md) · [Context management](docs/context-management.md) · [Security](SECURITY.md)

- [ ] Install a GPU build of `llama-cpp` and the embedding model, and confirm memory search turns itself back on. [Linux roadmap](docs/linux/roadmap.md#4-memory-recall)

### CAP-12A — Responsive context compaction · P0

- [ ] Comparable local and API baselines for short turns, warm long sessions, cold starts and vision/tool turns: prompt tokens, compaction time, provider wait, first text, first audio and fallback count. No text, paths or secrets in diagnostics.
- [ ] Separate bounded budgets for context preparation and first-text wait. Apply context-pressure accounting to API turns, without counting a stream header as visible text. Reproduce the case where slow compaction plus a silent stream hit the shared watchdog. Keep an absolute turn deadline.
- [ ] Compact natively between turns as the prompt nears its budget, reserving room for instructions, tools, images and the reply. Tune the byte guard against measured tokens. Foreground input wins; use the session lease and reject stale commits.
- [ ] A bounded extractive fallback when a turn cannot fit. Keep recent replies, open asks, decisions and exact identifiers. Never replay tool actions from a summary. No extra paid summary calls in the default path.
- [ ] Keep model capacity separate from what is sent per turn. Larger windows need verified support and cost checks. The Claude Code bridge is a provider like any other here.

**Acceptance.** A synthetic long conversation crosses the 32K budget with its
latest ask, decisions and original history intact. A stalled summary or stream
recovers within bounds with no repeated actions. Compare p50/p95 first text and
first audio against the current build.

### CAP-12B — Tagged long-term memory · P1

- [ ] Automatic local retrieval with the existing OpenClaw index and one bounded pre-reply step. Evaluate the pinned Active Memory hook. No extra generation calls for ordinary recall. A slow or missing index leaves dialogue usable. Skip greetings and routine commands.
- [ ] One fact, preference, event or decision per Markdown record in `data/workspace/memory/`, with a stable ID, source, date and tags. Open tag vocabulary with a small per-record cap and normalization; users can edit and merge tags. Import old notes without rewriting them.
- [ ] Rank records by semantic similarity, exact terms and weighted tags. A common tag only boosts candidates. Deduplicate, downrank superseded records, apply a minimum score. Start with up to four records and 600–1,000 tokens; an explicit "remember" request allows one deeper bounded search.
- [ ] Insert excerpts as temporary turn data after the stable prompt prefix, with the same ranking for local, API and Claude Code chat. Do not save excerpts into the conversation. Per-provider sharing permission for recalled memories, enforced at final request assembly. Indexes and embeddings stay local.
- [ ] Save explicit "remember this" requests and confirmed facts with provenance; corrections supersede older records. Keep guesses, credentials, role-play and screen/tool output out of automatic memory.
- [ ] In Settings: inspect, search, edit, export and delete memory. Clearing memory stops pending writers and removes derived indexes. Archived conversations cannot recreate cleared records.

**Acceptance.** An exact fact is found among hundreds of records sharing a tag.
Test new tags, English/Russian recall, corrections, duplicates, index failure,
model switching, cache reset, interrupted migration and sharing disabled. Zero
extra model calls for simple turns.

## CAP-13 — Telegram parity · P2

This repository has no Telegram adapter. Start by checking what the pinned
OpenClaw version offers.

- [ ] Audit the available adapter and pair it with an explicitly authorized Telegram account or chat.
- [ ] Text, photos and voice messages with the selected language and voice, and the same memory as the desktop.
- [ ] Remote requests get explicit device and capability scope; desktop permission does not grant every remote action.
- [ ] Retries, reconnects, duplicate delivery, attachment limits and an offline desktop without repeated actions.
- [ ] Configurable playback and notifications; no unexpected speech on several devices.
- [ ] Document setup, credential storage (system keyring), revocation and channel differences.

**Done when:** a desktop → Telegram → desktop scenario keeps context and
permissions, including voice and photo input and lost connectivity.

## CAP-14 — Public repository and distribution · P0

The fork is public under GPL-3.0-only with protected main, pull requests, CI on
Ubuntu and private vulnerability reporting. It publishes no releases. Terms for
character, model and voice assets are separate from the code license.

- [x] License, third-party notices, README, contribution and security guidance.
- [x] CI for checks that need no GPU, secrets or the owner's machine; GPU and quality tests stay separately runnable.
- [ ] A support matrix: distributions (developed on Arch, tested in CI on Ubuntu), compositors (wlroots, GNOME, KDE), GPU vendors and features. Advertise only tested combinations.
- [ ] No developer-specific paths: user-chosen model and data paths, spaces and Unicode, ordinary user accounts.
- [ ] Separate the assistant platform from character, sprite and voice packs; ship a default pack with clear distribution terms.
- [ ] Inventory licenses, attribution, redistribution and training-data provenance for code, models, fonts, sprites, voice samples and adapters.
- [ ] Audit history and any release artifacts for credentials, private data, personal paths and stray media before each publication.
- [ ] Decide on releases: tagged source releases with checksums first; packages later (see CAP-15).

**Done when:** a new user can get a tagged release, understand its
requirements, set it up and use the default configuration without the
developer's private voice or local files.

## CAP-15 — Install and first run · P0

Today Capri runs from a checkout: `npm ci`, `npm run doctor`, `npm run setup`,
`npm run models:pull`, `npm run desktop`. System packages (Node 24,
`llama-server`, optionally `uv`, `stockfish` and a keyring) come from the
distribution. [Installation](docs/installation.md)

- [x] Speech components get a pinned, uv-managed Python per component under `.runtime/`, with no global Python setup. A broken venv is moved aside, never deleted.
- [ ] `npm run doctor` names the exact distribution package for each missing dependency (Arch first, then Debian/Ubuntu and Fedora).
- [ ] A desktop entry (`.desktop` file and icon) so Capri starts from the app launcher.
- [ ] Packaging: an AUR package first. Flatpak only after weighing its sandbox against features that need host access (Wayland protocols, PipeWire, `llama-server`, AT-SPI).
- [ ] Progress, retry and resume across every component, including network loss. Respect metered connections: show download sizes and ask before large downloads.
- [ ] Verify downloads against pinned manifests; a partly installed model is never shown as ready.
- [ ] Change an installation later: add a language, move model storage, change voice or profile, repair or remove a component.
- [ ] Never need root. Data follows XDG directories, separate from the checkout.
- [ ] A guided first run inside the app, following the steps below.
- [ ] Setup dies with a crashed Capri: a watchdog under `setpriv --pdeathsig` that kills the whole setup process group (heritage rule 3).

| Step                        | The user chooses                                      | Capri explains or checks                                                      |
| --------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------- |
| 1. Welcome and requirements | Interface language                                    | Local processing, network downloads, what will be installed, missing packages |
| 2. Hardware and profile     | Recommended profile or override                       | Detected hardware, compute backends, quality trade-offs                       |
| 3. Inference                | Local model, API connection or Claude Code bridge     | Download size, cost and privacy of each choice                                |
| 4. Storage                  | Model and data locations                              | Download and installed size, free space, shared cache                         |
| 5. Languages                | Conversation, recognition and speech languages        | Available combinations, quality status, needed packs                          |
| 6. Character and voice      | A character/voice pack                                | Preview, language support, attribution                                        |
| 7. Devices and effects      | Microphone, output device, effect preset              | Live PipeWire device test, input level, voice preview                         |
| 8. Optional capabilities    | Screen, webcam, initiative, integrations, file scopes | Each grant separately, how to revoke it, which compositor features apply      |
| 9. Install and verify       | Confirm                                               | Per-component progress, retries, pause/resume, errors                         |
| 10. First conversation      | A short guided test                                   | Model ready, recognition, first reply, subtitles, where settings live         |

**Done when:** a tester sets Capri up on a clean supported distribution, has a
first conversation, understands what access is enabled, and can repair or
change the setup without starting over.

## CAP-16 — Updates, recovery and removal · P0

Today: `git pull`, `npm ci`, restart. The in-app installer reports unavailable,
but automatic update checks still query upstream `CapriChooms/CapriCore` and
can announce Windows releases this fork cannot install.

- [ ] Turn off upstream update checks, or point them at this fork's tagged releases. Notify through a desktop notification, not a tray balloon.
- [ ] Version the app, settings schema, model profiles, character packs and voice packs separately, with a compatibility matrix.
- [ ] Before an update: verify it, prepare migrations, back up settings. After a failed update: roll back to the previous tag.
- [ ] Update owned runtimes (`.runtime/`) without breaking shared model caches, trained voices or user recordings.
- [ ] A repair flow (`npm run doctor` and an in-app equivalent) that recovers from an interrupted update without a terminal.
- [ ] Removal keeps user data and models by default, with separate explicit choices to delete them. It removes Capri's desktop entry, autostart entry and user services and leaves everything else alone. Preflight every removal first and refuse symlinks on owned paths (heritage rules 5–7).
- [ ] With a package (CAP-15), updates come from the package manager and the in-app path only notifies.

**Done when:** update, interrupted update, rollback, repair and removal are
tested with existing conversations and custom settings.

## CAP-17 — Hugging Face model and voice library · P1 foundation, P2 expansion

The foundation is platform-neutral and kept: Hub search and inspection,
encrypted optional tokens, pinned verified downloads, complete GGUF shard
imports, model-aware capabilities and context, disk estimates, cancellation and
removal. GGUF imports run through the managed `llama-server` host (its settings
are still named `ollama*`). Saved tokens need a system keyring (GNOME Keyring
or KWallet). [Implementation plan](docs/plans/hugging-face-integration.md)

- [x] **CAP-17A — Shared contracts.** Versioned model/package descriptors and install plans, retained voice selections, model-aware capability checks, protected credentials.
- [x] **CAP-17B — Hub and downloads.** Search and link import, immutable revisions, verified resumable downloads, disk accounting, repair and cache inventory.
- [x] **CAP-17C — Local language models.** Import complete GGUF sets and optional projectors through the managed host; select, cancel, repair and remove.
- [ ] **CAP-17C — Linux check.** Import, select and chat with a Hub GGUF model end to end on Linux with Vulkan, then CUDA and ROCm builds of `llama-server`.
- [ ] **CAP-17C — Broader qualification.** Templates, context, tools, vision, switching and recovery for each advertised architecture and quantization.
- [ ] **CAP-17D — Voice adapters on Linux.** Per-language Chatterbox Turbo, multilingual Chatterbox and Qwen3-TTS CPU adapters, and English Turbo training with audition and rollback. The code exists; it installs once the voice locks are rebuilt for Linux.
- [ ] **CAP-17D — Broader voice qualification.** Language and device quality and latency; evaluate families such as Kokoro; training recipes only for compatible architectures.
- [x] **CAP-17E — Hub access and cloud preset.** Optional gated/private Hub access and a Hugging Face Inference Providers OpenAI-compatible preset.
- [ ] **CAP-17E — More backends.** HF cloud TTS and an approved local Transformers adapter, with explicit data-sharing choices.
- [ ] **CAP-17F — Qualification.** Each advertised model, language and device combination, plus clean setup, update, repair, cancellation, offline use and removal.

**Done when:** users can find a supported model, understand its hardware and
language limits, install it with accurate progress, use it, switch or recover
safely and remove it. Imported metadata is checked against the pinned runtime
before features turn on.

## Release checklist

- [ ] Supported distributions, compositors and hardware, and experimental limits, are documented.
- [ ] Every advertised feature passes setup and end-to-end checks on a clean machine.
- [ ] No feature that reports "not available on Linux yet" is advertised.
- [ ] Shared context, cancellation, action verification and data migration have no blocking regressions.
- [ ] Performance reports separate cold and warm, first text and first audio.
- [ ] Memory changes pass the long-session, bounded-recall, deletion and sharing checks from CAP-12.
- [ ] Capture and actions stay off until selected; indicators match real behavior.
- [ ] Download integrity, attribution and asset distribution checks are complete.
- [ ] Diagnostics are redacted; artifacts hold no private data or credentials.
- [ ] Removal, data preservation, backup/restore and recovery are verified.

## Mapping from the original list

| Original item                                   | Epics                                                                     |
| ----------------------------------------------- | ------------------------------------------------------------------------- |
| 1. Voice effects                                | CAP-01, CAP-11                                                            |
| 2. Multilingual TTS/STT                         | CAP-02, CAP-06, CAP-15                                                    |
| 3. Files, desktop tasks and contextual comments | CAP-03, CAP-04, CAP-11                                                    |
| 4. Screen and webcam                            | CAP-05, CAP-11                                                            |
| 4.5. Lightweight models                         | CAP-06                                                                    |
| 5. Speed                                        | CAP-07, CAP-12A                                                           |
| 6. Remove unused files                          | CAP-08                                                                    |
| 7. Professional refactoring                     | CAP-09                                                                    |
| 8. Bugs and polish                              | CAP-10                                                                    |
| 9. GitHub release                               | CAP-14, CAP-16                                                            |
| 10. Installer wizard                            | CAP-11, CAP-15                                                            |
| Added foundations                               | CAP-12A compaction, CAP-12B tagged memory, CAP-13 Telegram, CAP-16 update |
| Hugging Face integration                        | CAP-17                                                                    |

Split each epic into issues with a concrete workflow, dependencies, acceptance
criteria and validation evidence. Keep each change to one reviewable feature or
behavior-preserving step.
