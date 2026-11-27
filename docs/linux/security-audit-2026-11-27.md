# Security audit of inherited upstream code — 2026-11-27

Scope: everything this fork inherited from CapriChooms/CapriCore, audited
after PR #5 removed the diagnostic-report upload, upstream update checks,
donation and community links. Question asked: does any remaining code send
data or money to the upstream author, collect telemetry, or run untrusted code?

## Verdict

**No telemetry, analytics or malware was found, and nothing at runtime contacts
upstream servers.** No analytics or crash-upload SDK is present. Crash and
diagnostic reports stay on disk. No obfuscated strings, `eval` or `new
Function` were found in the app code. Every outbound connection goes to a
service the user selects or triggers (or to this fork's own GitHub releases).

Three items are worth fixing (below), plus dead upstream text to clean up.

**Status (same day):** #1 and the leftovers are fixed. For #2, the ASR lock
is now hashed, and its yanked `av==18.1.0` (memory corruption, a double free
when decoding audio) was bumped to 18.1.1. The voice locks target Windows
only, so they get hashes when they are rebuilt for Linux
([roadmap](roadmap.md), Speech). #3 waits for the Russian-language removal.

## Findings to act on

| #   | Severity              | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Proposed fix                                                                                                                |
| --- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 1   | Low                   | The updater falls back to `GH_TOKEN`/`GITHUB_TOKEN` or `gh auth token` (`packages/updater/src/github.mjs:33`, used through `apps/desktop/github-access.mjs:45`). Automatic update checks are on by default, so a signed-in GitHub CLI token, which often has full `repo` scope, is sent to `api.github.com` at startup. It goes only to GitHub (host-allowlisted), never to upstream, but a public repo needs no token.                                     | Remove the CLI and environment fallback. Use only a token the user saves in Settings.                                       |
| 2   | Medium (supply chain) | Four Python lock files pin versions but have **no `--hash` entries**: `config/asr-requirements.lock.txt` (used on Linux and in CI), `requirements-voice-blackwell.lock`, `requirements-voice-training.lock`, `requirements-voice-amd.lock`. A compromised PyPI mirror or package re-upload would not be caught. `requirements-qwen-tts.lock` and `router-requirements.lock.txt` are hashed. Git dependencies (chatterbox, Perth) are pinned to commit SHAs. | Regenerate with `uv pip compile --generate-hashes` (needs network). Delete the AMD lock: it lists only Windows ROCm wheels. |
| 3   | Info                  | The API provider presets include **ProxyAPI (`api.proxyapi.ru`)**, a Russian reseller of OpenAI/Anthropic access (`apps/desktop/renderer/inference-panel.mjs:16`, `inference-api.mjs:211`). It is used only if the user picks it and enters a key, but anyone who does sends all chat traffic through it.                                                                                                                                                   | Remove the preset together with the Russian-language removal.                                                               |

## Upstream leftovers (no network effect)

- **Dead locale strings** in `apps/desktop/locales/{en,fr,pl,uk}.json` and
  `guide-locales/{fr,pl,uk}.json`: Lava.top/Boosty donation text, "send the
  ZIP to Overyx in a Discord DM", token instructions for `CapriChooms/Capri`,
  and capri-core.com. Nothing rendered them. Deleted (88 entries).
- `tools/community/update-hall-of-fame.mjs` read contributors from
  `CapriChooms/Capri` through the GitHub API. It needed collaborator access to
  upstream's private repository, so it could never work for this fork.
  Deleted; the roster stays as a frozen snapshot.
- `tools/verify/verify-updates.mjs` mocked upstream release URLs. It now
  uses this fork's.
- `.github/rulesets/README.md`, `README.md` and older `docs/releases/*` mention
  upstream as history. That is fine to keep.
- Credits (`credits-panel.mjs`, `config/hall-of-fame.json`) name upstream
  contributors. This is attribution, which suits a GPL fork. Keeping it is
  your call.

## Outbound network inventory

| Destination                                                                                                                  | Trigger                                              | What is sent                                                                         | Opt-in                                     |
| ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------ |
| `api.github.com` / GitHub CDN, `OleksandrKukotin/CapriCore-Linux` only                                                       | Startup plus a periodic update check (on by default) | Release list request, optionally a token (see #1)                                    | Default on, can be turned off              |
| `html.duckduckgo.com`, `lite.duckduckgo.com`, Wikipedia REST                                                                 | Message sent with Internet mode on                   | Search query. User-Agent names this fork.                                            | Per message, and the skill must be enabled |
| `store.steampowered.com/search/suggest`                                                                                      | "Launch game X" request                              | Game title                                                                           | User action                                |
| `open.spotify.com/oembed`                                                                                                    | Spotify link playback                                | Track or album URL                                                                   | User action                                |
| `lichess.org/game/export`                                                                                                    | Chess helper on a Lichess page                       | Game ID                                                                              | User action                                |
| `auth.openai.com`, `api.openai.com`, `chatgpt.com`                                                                           | Connecting a ChatGPT plan                            | OAuth (dynamic client registration with OpenAI directly, no middleman), prompts      | User action                                |
| OpenAI, Anthropic, Gemini, Groq, DeepSeek, OpenRouter, HF Router, ProxyAPI, custom                                           | Remote API mode                                      | Prompts and API key                                                                  | User configures                            |
| `api.elevenlabs.io`, OpenAI TTS                                                                                              | External voice                                       | Text to speak and API key                                                            | User configures                            |
| `huggingface.co`, `raw.githubusercontent.com`, `qaihub-public-assets` S3, `registry.ollama.ai`, PyPI, `download.pytorch.org` | Model, voice and runtime setup                       | Download requests only. Files are checked against pinned revision, size and SHA-256. | User runs setup                            |
| Discord local IPC socket                                                                                                     | Rich Presence                                        | "Hanging out with Capri" plus a GitHub button                                        | Off by default; no app ID shipped          |
| `translate.googleapis.com`                                                                                                   | `tools/localization/translate-*.mjs`                 | UI strings                                                                           | Developer tool, run by hand                |
| `127.0.0.1`                                                                                                                  | Ollama, OpenClaw gateway, voice and ASR workers      | Local only                                                                           | n/a                                        |

## Code-execution review

- **npm**: 616 lockfile entries, all from `registry.npmjs.org`, all with
  integrity hashes. Packages with install scripts: openclaw, electron,
  esbuild (allowed), and koffi, @google/genai, protobufjs (not allowed). The
  unfamiliar `@scoriiu/fenshot` is an MIT-licensed chess board reader with no
  network code or `eval`.
- **postinstall** (`packages/runtime/bin/patch-openclaw.mjs`): applies two
  sets of patches. Each is checked against a before and after SHA-256 and
  the expected package version, and refuses to touch any file it does not
  recognise.
  - `config/dependency-security-patches.json`: denial-of-service backports
    for minimatch and glob (GHSA-g3hv-75wg-m249, GHSA-3g3m-2fjr-6pw4). Read
    in full; harmless.
  - `integrations/openclaw-compat/patches.json`: 12 OpenClaw files, 165 added
    lines. Read in full: prompt and reasoning budgets, compaction fallback,
    tool allow-lists, and owner-only request headers. No network, exec,
    filesystem or credential access.
- **Model downloads** (`integrations/model_download.py`, the Node installer)
  check size and SHA-256 at pinned revisions. `torch.load` always uses
  `weights_only=True`. `from_pretrained` loads local folders only, with
  `trust_remote_code=False`.
- **`executeJavaScript`** is used only on the app's own windows, with
  `JSON.stringify`-escaped arguments.
- **CI** (`.github/workflows/ci.yml`): actions are pinned to commit SHAs and
  the workflow has `contents: read` permission. It does not use
  `pull_request_target` and does not need secrets.
