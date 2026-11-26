<img src="assets/default/icon-source.png" alt="CapriCore lightning logo" width="72" align="right">

# CapriCore-Linux · based on Capri 1.2.2

Capri is a Linux AI desktop companion powered by OpenClaw. Run a bundled local model, import a compatible Hugging Face GGUF model, connect to an OpenAI-compatible API, or chat through your signed-in Claude Code. Capri supports text and voice chat, persistent memory, an animated desktop avatar, and optional tools for working with apps and files.

[Documentation](docs/README.md) · [Windows heritage and Linux plan](docs/linux/windows-heritage.md) · [Contribute](CONTRIBUTING.md) · Upstream: [CapriChooms/CapriCore](https://github.com/CapriChooms/CapriCore), [website](https://capri-core.com/), [Discord](https://discord.gg/capricore)

**CapriCore-Linux** is a Linux-only fork of [CapriChooms/CapriCore](https://github.com/CapriChooms/CapriCore), developed on Arch Linux with sway (Wayland). The Windows installer, updater and native helpers were removed; what they taught us, and the Linux mechanism that replaces each one, is in [docs/linux/windows-heritage.md](docs/linux/windows-heritage.md). The fork runs from source; there is no installer or in-app updater.

### Linux status

| Area                                                                                                                      | Status                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Text chat through an API connection, including [Claude Code](#chat-through-claude-code-no-model-download)                 | Works from source; no local model needed                                                                                                                                  |
| Local models through llama.cpp                                                                                            | Works from source with a system `llama-server`                                                                                                                            |
| Memory recall                                                                                                             | Needs `llama-server` and the embedding model; switched off automatically without them                                                                                     |
| Hardware probe, VRAM/GPU load, CPU temperature, process load                                                              | Works (DRM sysfs, hwmon, `/proc`)                                                                                                                                         |
| Desktop window                                                                                                            | Opens and is clickable on Wayland. Its transparent area also catches clicks, and dragging the window does not work yet                                                    |
| Native avatar overlay                                                                                                     | Rust layer-shell surface in [`apps/overlay`](apps/overlay)                                                                                                                |
| Coding mode (editor discovery, VS Code bridge), Discord Rich Presence, Stockfish                                          | Works (system packages)                                                                                                                                                   |
| Speech recognition and voice                                                                                              | Setup ported to Linux (`node tools/setup/setup.mjs`), but the Python locks are still the Windows ones and must be recompiled first. Accelerated Qwen voice is unavailable |
| Computer control, app actions, Spotify/YouTube Music, awareness, call audio, screen capture, virtual camera, tool sandbox | Not ported yet: these report "not available on Linux yet"                                                                                                                 |

## Changes in this fork

- Windows-only code removed; Linux backends for hardware probing, process load, editor discovery, Discord IPC and file locations.
- Speech component setup ported from PowerShell to Node: a pinned, uv-managed Python per component, with broken environments moved aside instead of deleted.
- `npm run claude-bridge` lets Capri chat through the Claude Code CLI with no model download.
- API mode starts without llama.cpp; memory search is switched off until local memory is available.
- The companion window stays clickable on Wayland.
- Capri's prompts say she lives on a Linux desktop.

Upstream release notes up to 1.2.2 are in [docs/releases](docs/releases).

## What Capri can do

- **Choose your inference.** Use bundled Qwen3.5 models, BETA Gemma/Ministral alternatives, compatible Hugging Face GGUF imports, or saved OpenAI-compatible API connections. Switch from the Local/API control without clearing the conversation.
- **Reserve resources.** The Local menu has a live [CPU/GPU load control](docs/local-model-load.md), enabled at 85% by default. GPU utilization is an adaptive target; brief peaks remain possible.
- **Talk and remember.** Text chat, optional local speech recognition and voice, independent language settings, communication styles, searchable memory facts and a local document knowledge base.
- **Live on the desktop.** Animated expressions and mouth layers, headpats, lightning teleports, window-edge poses, floating dialogue, compact controls, tray mode, themes and resource monitoring.
- **Choose how much she moves.** Optional [desktop roaming](docs/desktop-roaming.md), with a 30-second to 30-minute interval and automatic pauses during interaction.
- **Use tools with permission.** Scoped app/file actions, Spotify, Discord desktop control, web search, deep-thinking mode, recorded workflows and approved user tools. Computer control is BETA and uses a visible indicator with Escape cancellation.
- **React to music and calls.** Optional local system-audio music detection with BPM animation, and microphone/system-audio call features with a separately configured virtual cable.

Capabilities depend on the selected model, its tool/image support and your permissions. Complex workflows, individual GPU backends and additional voices still need configuration and can require your help; see [current limits](docs/releases/1.0.0.md#limits-to-know).

[Set up native NPU and editor integration, and follow desktop task progress](docs/native-npu-and-coding.md).

## Run from source

Requirements: an x86-64 Linux desktop and Node.js 24.x with npm. For local models and
memory recall you also need [llama.cpp](https://github.com/ggml-org/llama.cpp)'s
`llama-server`. On Arch: `pacman -S llama-cpp` plus a GPU backend such as `ggml-vulkan`,
`ggml-cuda` or `ggml-hip`. Put `llama-server` on `PATH` or set `CAPRI_LLAMA_PATH`.
Optional: `uv` for speech components, `stockfish` for chess, and a keyring service
(GNOME Keyring or KWallet) if you want to save API keys.

```sh
node --version   # v24.x
npm ci
npm run doctor
npm run setup
npm run models:pull
npm run desktop
```

`npm stop` releases managed resources. Setup explains hardware profiles and saves an
ignored local override. The model command downloads the selected text model and the
memory embedding model; allow several GB of disk space.

The source tree includes the reviewed Capri sprites and animations, plus a procedural
fallback avatar. [Detailed setup](docs/installation.md).

Update with `git pull` and `npm ci`, then restart Capri.

### Chat through Claude Code (no model download)

If [Claude Code](https://claude.com/claude-code) is installed and signed in, Capri can
use it as her language model:

```sh
npm run claude-bridge      # terminal 1: serves Claude Code on 127.0.0.1:18793
npm run desktop            # terminal 2
```

In Capri open **Settings → API connections → Add an API connection → Custom**:

| Field              | Value                                                                                                            |
| ------------------ | ---------------------------------------------------------------------------------------------------------------- |
| Base URL           | `http://127.0.0.1:18793/v1`                                                                                      |
| API key            | leave blank                                                                                                      |
| Model              | `claude-code-haiku` (fastest), `claude-code-sonnet`, `claude-code-opus`, or `claude-code` (your account default) |
| Tool calls, images | off                                                                                                              |

Then **Save → Test → Use connection**. Each reply runs `claude -p` with no tools, no MCP
servers and no settings files, so it can only write text. Capri's own tools (apps,
files, Discord) are not available this way. Messages go to Anthropic under your Claude
account. The bridge refuses requests from web browsers; pass `--require-token` to also
demand a key. Replies take several seconds because Capri's agent prompt is large.

### Speech components

Speech is optional and off by default. Each component installs into its own Python
environment under `.runtime/`:

```sh
node tools/setup/setup.mjs recognition [en|fast-multi|multi]
node tools/setup/setup.mjs voice [--profile auto|legacy|blackwell|amd]
node tools/setup/setup.mjs multilingual --language <code>
node tools/setup/setup.mjs qwen [--russian]
node tools/setup/setup.mjs router
```

The pinned Python locks in `config/` were compiled for Windows. Until they are
recompiled for Linux, these commands will not complete.

## System requirements

**Linux, x86-64**, with a Wayland or X11 desktop. The smallest supported configuration has
**8 GiB system RAM**. Requirements above that depend on where the language model
runs and which speech components you enable.

| Inference mode                     | System RAM                                      | Dedicated GPU / VRAM                                         | Model storage                               |
| ---------------------------------- | ----------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------- |
| Cloud API (BETA)                   | 8 GiB planning minimum; local speech needs more | No dedicated GPU required for text chat                      | No local conversation-model weights         |
| Bundled local LLM                  | See the hardware profiles below                 | Optional for CPU inference; enough free VRAM for GPU offload | Selected model weights plus runtimes        |
| Hugging Face local GGUF (BETA)     | Depends on model, quantization and context      | Depends on model and offload; CPU execution is possible      | Selected files and temporary download space |
| Local API, such as Lemonade (BETA) | Capri plus the local server's requirements      | Depends on the server's CPU/GPU/NPU backend                  | Models managed by that server               |

**RAM, VRAM and free disk space are separate resources.** GPU-offloaded weights
use VRAM; CPU inference uses RAM, and partial offload uses both. Shared GPU memory
borrows system RAM. Leave room for the desktop, games and other applications.

### API connections (BETA)

Open **Settings → API connections** to add, test and switch between saved
connections.

| Provider preset                     | API base URL                                               |
| ----------------------------------- | ---------------------------------------------------------- |
| OpenRouter                          | `https://openrouter.ai/api/v1`                             |
| ProxyAPI                            | `https://api.proxyapi.ru/v1`                               |
| DeepSeek                            | `https://api.deepseek.com`                                 |
| Google Gemini                       | `https://generativelanguage.googleapis.com/v1beta/openai/` |
| Hugging Face Inference Providers    | `https://router.huggingface.co/v1`                         |
| Lemonade (local CPU/GPU/NPU server) | `http://127.0.0.1:13305/api/v1`                            |
| Claude Code bridge (this fork)      | `http://127.0.0.1:18793/v1` (Custom, blank key)            |
| Custom                              | Your OpenAI-compatible Chat Completions endpoint           |

For cloud providers, use a key and model ID issued by the chosen provider. Saving a
key needs a keyring service (GNOME Keyring or KWallet); without one, Capri refuses to
save it.
For Lemonade or another loopback server, leave the key blank unless the server
requires authentication. Tool calls and images must
be supported by that exact model; enable their switches accordingly. Cloud APIs
need an internet connection and an available provider account; usage charges and
provider data policies apply. Messages, relevant memory and tool results are sent
to the provider; selected screen images are sent when vision is enabled and used.

API mode skips downloading the local conversation LLM and skips loading it by
default. Keep **Skip local language model when using an API** enabled to retain
that startup behavior; turning it off can warm an already installed local model.
Capri's interface,
local embedding model and CPU request classifier still run locally. Recognition
remains local. TTS is local by default; **Settings → Voice API** can independently
offload speech to an external provider and unload the local voice model.
See [external voice](docs/external-tts.md) for setup and privacy details. A model
served by Lemonade on the same PC still consumes that PC's resources.

### Hugging Face models (BETA)

For **local language models**, select a Hugging Face model in
**Settings → Language model**. Capri downloads a selected **GGUF**
quantization, including all parts of split GGUF models, and imports it into the
managed llama.cpp runtime. The model architecture must be supported by that runtime.
Vision also needs compatible model/projector files; tool and image support are
checked separately. Arbitrary Transformers/Safetensors repositories are not
automatically compatible.

Memory use depends on the chosen weights, quantization, context and GPU offload.
Before a specific model is selected, RAM/VRAM requirements are **unknown**, not
the same as cloud API mode. Check the selected model's estimates and available
memory before downloading. Local models need no cloud API account; gated Hub
repositories may require accepting their license and providing an HF token.

For **voice**, the supported adapters include Chatterbox Turbo (English),
Chatterbox Multilingual and **Qwen3-TTS 0.6B Base (CPU, BETA)**. Qwen3-TTS adds an
estimated **4–8 GiB RAM**, needs no dedicated VRAM for synthesis and may run slower
than real time. Language availability depends on the adapter. Downloading an
arbitrary Hub TTS model does not make it compatible or guarantee Capri's voice.

### Hardware profiles

These planning figures cover one conversation with **32K context** and the
bundled quantizations. VRAM figures describe model consumption, while system RAM
targets describe total PC capacity. They do not include optional speech.

| Text model            | Estimated model VRAM in use | System RAM target with a suitable GPU | Conservative CPU-fallback RAM target |
| --------------------- | --------------------------- | ------------------------------------- | ------------------------------------ |
| Qwen3.5 0.8B          | 1.3–2.2 GiB                 | 8 GiB                                 | 8 GiB                                |
| Qwen3.5 2B            | 2.8–4 GiB                   | 8 GiB                                 | 16 GiB                               |
| Qwen3.5 4B            | 4–6 GiB                     | 12 GiB                                | 24 GiB                               |
| Qwen3.5 9B            | 7–10 GiB                    | 16 GiB                                | 32 GiB                               |
| Ministral 3 3B (BETA) | 3.5–6 GiB                   | 12 GiB                                | 16 GiB                               |
| Gemma 4 E2B (BETA)    | 8–12 GiB                    | 16 GiB                                | 24 GiB                               |

GPU acceleration uses the installed llama.cpp Vulkan backend and a compatible driver. A card
needs additional headroom for the display, other applications and any GPU voice.
CPU execution and partial offload can be slower and consume more system RAM.

**16 GiB RAM plus 16 GiB VRAM does not guarantee comfortable 9B operation.**
The 16 GiB RAM target assumes text-only use and a working GPU backend; it is not
a promise that RAM stays almost unused. The desktop, the browser, Capri's core,
CPU speech recognition and optional TTS still need system RAM. Loading peaks,
longer context and driver-managed shared memory can increase it further. On a
16 GiB PC, start with 2B/4B and speech off, or use an external API. Confirm actual
offload rather than inferring it from VRAM capacity. Diagnostic reports include
`resources.json` with the local model's resident CPU/GPU allocation counters and
Capri's process working sets, separately from total system usage.

### Optional speech and local components

| Enabled component                       | Additional RAM estimate | Additional VRAM estimate |
| --------------------------------------- | ----------------------- | ------------------------ |
| English Chatterbox voice                | 2–4 GiB                 | 2.5–4 GiB                |
| Multilingual Chatterbox voice (BETA)    | 3–6 GiB                 | 3–6 GiB                  |
| Hugging Face Qwen3-TTS CPU voice (BETA) | 4–8 GiB                 | 0 GiB                    |
| English recognition on CPU              | 1–3 GiB                 | 0 GiB                    |
| Multilingual recognition on CPU         | 2–5 GiB                 | 0 GiB                    |
| CPU request classifier                  | 0.1–0.5 GiB             | 0 GiB                    |

The app/core and transient memory retrieval have a separate planning allowance of
**2–4 GiB RAM** and approximately **0.2–1.2 GiB graphics memory**. A discrete GPU
is not required for the interface. Larger context, images and model loading can
increase peaks. These ranges are estimates, not measured guarantees or download
sizes. Chatterbox voice uses NVIDIA CUDA or experimental support for selected
supported AMD ROCm GPUs; Qwen3-TTS provides the separate CPU voice option.
See [AMD voice requirements](docs/amd-voice.md) and [hardware policy](docs/hardware.md).

**Settings → API connections → AI apps and ChatGPT plan** can discover installed
AI apps and local model servers. Add a detected local server or authorize a
separate ChatGPT plan connection through the official sign-in flow. Claude and
Gemini use their API-key connections; app logins and conversations are not
imported. See [AI app connections](docs/desktop-ai-providers.md).

### Free disk space

Text chat through an API or the Claude Code bridge needs only the source tree and
`node_modules` (about 1–2 GiB). A local text model adds 1–6 GiB, and the memory
embedding model about 1.1 GiB. Speech components add several GiB each; recognition
alone is about 1 GiB with its models, and a GPU voice 6–9 GiB.

## Use and development

`npm run desktop` opens the desktop companion. Enter sends; Shift+Enter adds a line. On Windows the header and sprite could be dragged; on Wayland, moving the window is not implemented yet. The diamond toggles signal core. The menu contains languages, audio, appearance and permissions. Interface language is independent of conversation, recognition and voice. Camera support is not implemented. [Desktop guide](docs/desktop.md), [languages](docs/languages.md).

```sh
npm run check
npm test
npm run format:check
npm run verify:dimming
npm run verify:languages
```

Default Node tests use fixtures; `npm run test:assets` qualifies the separately supplied full sprite pack. Python 3.11 is needed for Python checks and speech development.

See [CONTRIBUTING](CONTRIBUTING.md), [SECURITY](SECURITY.md), [architecture](docs/architecture.md) and [third-party notices](THIRD_PARTY_NOTICES.md). Existing installations preserve local model choices, memory and trained voice data. Project-owned code is GPL-3.0-only; see [LICENSE](LICENSE). Optional media/model packs have separate terms.

## Companion controls

The reviewed character sprites and animations are included in the source tree.
New support, report, personality, wake sound,
follow-up listening and memory controls are described in [Companion controls](docs/companion-controls.md).
See [Character assets](docs/character-assets.md) for the separate artwork notice.

This fork has no in-app updater: update with `git pull` and `npm ci`. Personal data in
`data/` is not tracked by git and is kept.

Choose Neutral, Romantic, Business or Wild under **Companion settings → Conversation**.
Styles apply to the next reply and retain your editable Personality. Simple replies
are brief by default. [Communication styles](docs/communication-styles.md).

Choose **Language model** in Settings to download and switch between Qwen3.5
0.8B, 2B, 4B and 9B, or the BETA Gemma 4 E2B and Ministral 3 3B choices. The menu shows
separate RAM/VRAM estimates for each choice. [Model selection](docs/models.md).

Optional inference routes include [external AI providers](docs/external-api.md), local Hugging Face GGUF imports, and the bundled Qwen3.5, Ministral 3 and Gemma 4 models. Speech is a separate choice: local GPU Chatterbox, CPU Qwen3-TTS (BETA), or an optional [external voice API](docs/external-tts.md). [AMD speech requirements](docs/amd-voice.md).

## Privacy and safety

Local inference keeps model requests on the PC. Selecting a cloud API sends the
request context, relevant memory and enabled tool results to that provider;
screen images are shared when vision is enabled and used. Optional downloads still
contact their hosting services. Review permissions before enabling desktop tools.

API credentials are encrypted with the desktop keyring (Secret Service or KWallet) through Electron's safe storage. Without a keyring, Capri refuses to save them rather than store them weakly; loopback connections such as the Claude Code bridge need no key. Conversation history,
attachments and ordinary memory are stored locally **without full encryption**;
the separately password-protected private memory has its own protection. Diagnostic
exports are saved for review and are not uploaded automatically. See [Security](SECURITY.md)
and [diagnostic reports](docs/diagnostic-reports.md).

## Community and development

This is a personal fork. Send changes through a pull request against `main`; CI runs
the `linux` source checks and builds the `overlay` on Ubuntu. Issues are disabled for
now, so describe problems in a pull request. Problems that also affect upstream Capri
belong in [CapriChooms/CapriCore](https://github.com/CapriChooms/CapriCore/issues/new/choose),
and security issues in its [private vulnerability reporting](https://github.com/CapriChooms/CapriCore/security/advisories/new).
The [Hall of Fame](docs/hall-of-fame.md) preserves upstream's early-access supporters,
donors, helpers and core team.

Project-owned code is **GPL-3.0-only**. Character artwork, voices, model weights
and third-party packages have separate terms; see [licensing](docs/licensing.md)
and [third-party notices](THIRD_PARTY_NOTICES.md). Earlier release notes and dated
implementation plans are historical records; current setup guidance starts in
the [documentation index](docs/README.md).
