# Installation (Linux, from source)

CapriCore-Linux runs from a source checkout. There is no graphical installer or
in-app updater; update a checkout with `git pull` followed by `npm ci`.

## Requirements

| Component | Needed for | How to get it |
|---|---|---|
| Node.js 24.x with npm | Everything | Distribution package, `fnm`/`nvm`, or the official tarball |
| `llama-server` with Vulkan | Local language models | A llama.cpp Vulkan build (package or release); set `CAPRI_LLAMA_PATH` if it is not on `PATH` |
| Vulkan driver | GPU offload | Mesa RADV (AMD), ANV (Intel) or the NVIDIA driver |
| `uv` | Speech recognition and voice environments | `pacman -S uv`, your distribution's package, or Astral's installer; or set `CAPRI_UV_PATH` |
| `stockfish` | Chess commentary | Distribution package |
| `nvidia-smi` | NVIDIA VRAM readings | NVIDIA driver utilities |

AMD and Intel GPU memory, GPU load and temperatures are read from sysfs; no extra
tool is needed.

## Run

```sh
npm ci
npm run doctor        # hardware, software and profile diagnostics
npm run setup         # choose a hardware profile (saved as an ignored local override)
npm run models:pull   # downloads the selected text model and the memory embedding model
npm run desktop
```

`npm stop` releases managed resources. `npm start` / `npm run chat` run the core
without the desktop.

## Speech components

Recognition and voice run as Python workers in private environments under
`.runtime/` (`asr-venv`, `router-venv`, `voice-training-venv`, `qwen-tts-venv`).
Their interpreters are `.runtime/<name>/bin/python`. The Windows setup scripts that
created these environments were removed; the recipe (pinned Python through `uv`,
hash-locked `uv pip sync`, index isolation) is documented in
[windows-heritage.md](linux/windows-heritage.md#python-runtime-provisioning--p0)
and is the next step for Linux.

Capri starts with microphone capture and voice replies off. Their models stay
unloaded until you enable the microphone or speaker button.

## Data and rollback

`data/`, `.runtime/` and `logs/` are ignored by git. `data/workspace` owns memory,
`data/openclaw` owns conversation and credentials, and `data/desktop` stores UI
settings. Back up private data separately from the source tree. To roll back, stop
Capri and check out an earlier commit in a separate folder; do not assume an older
version can read newer settings.

Dependency lifecycle policy allows the reviewed OpenClaw compatibility hook, Electron
and esbuild installers. Unused transitive Koffi, Google SDK no-op and protobuf
postinstall hooks are explicitly disabled. Changes to this policy require dependency
review.

Stop managed Capri services before deliberately changing a hardware profile. Setup
preserves unrelated local overrides and reconciles only managed model/context fields
in an existing Gateway configuration; memory, plugins and tool permissions are
retained.
