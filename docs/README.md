# Capri documentation

These guides describe **CapriCore-Linux**, the Linux-only fork of CapriCore. Start
with the [project overview and Linux status](../README.md) and
[installation from source](installation.md). What the removed Windows code did, and
the Linux mechanism planned for each feature, is in
[Windows heritage](linux/windows-heritage.md).

Release notes under `releases/`, and the `plans/`, `bugs/` and `verification/`
folders, are historical records of the Windows project and describe it as it was.

## Installation and models

| Topic                                       | Guide                                                                                        |
| ------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Install and run from source                 | [Installation](installation.md)                                                              |
| Local language models and Hugging Face GGUF | [Model selection](models.md)                                                                 |
| OpenAI-compatible cloud and local APIs      | [External AI providers](external-api.md)                                                     |
| RAM, VRAM and supported backends            | [Hardware](hardware.md), [AMD voice requirements](amd-voice.md)                              |
| Languages and speech compatibility          | [Languages](languages.md), [speech language compatibility](speech-language-compatibility.md) |
| Voice installation and optional packs       | [Voice installation](voice-installation.md), [voice distribution](voice-distribution.md)     |

## Everyday use

| Topic                                     | Guide                                                                                                 |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Desktop, floating avatar and settings     | [Desktop guide](desktop.md), [companion controls](companion-controls.md)                              |
| Personality and communication             | [Personality](personality.md), [communication styles](communication-styles.md)                        |
| Context and local memory                  | [Context management](context-management.md)                                                           |
| Microphone, wake phrase and voice effects | [Microphone](desktop-microphone.md), [wake phrase](wake-phrase.md), [voice effects](voice-effects.md) |
| Voice in calls and system audio           | [Voice calls](voice-calls.md)                                                                         |
| Timers and reminders                      | [Timers and actions](timers-and-actions.md)                                                           |
| Community acknowledgements                | [Hall of Fame](hall-of-fame.md)                                                                       |

## Permissions and automation

| Topic                            | Guide                                                                              |
| -------------------------------- | ---------------------------------------------------------------------------------- |
| Application and file permissions | [Application actions](application-actions.md), [file actions](file-actions.md)     |
| Screen capture and observation   | [Screen snapshot](screen-snapshot.md), [screen observation](screen-observation.md) |
| Initiative                       | [Initiative](initiative.md)                                                        |
| User-provided tools              | [User tools](user-tools.md)                                                        |

Some model and voice adapters remain beta features. Read the applicable
limitations before granting access. Computer control is limited to opening
permitted apps and web pages and typing into inspected fields. External providers receive the content needed for
requests when selected. Ordinary conversation history and memory are stored
locally and are not fully encrypted; see the [security policy](../SECURITY.md).

## Troubleshooting and development

- [Create and review diagnostic reports](diagnostic-reports.md). A saved report
  is not uploaded automatically; review it before attaching it to a public issue.
- [Report a bug](https://github.com/CapriChooms/CapriCore/issues/new/choose) or
  [report a security vulnerability privately](https://github.com/CapriChooms/CapriCore/security/advisories/new).
- [Contribute through a fork and pull request](../CONTRIBUTING.md), read the
  [architecture](architecture.md), or inspect the [roadmap](../ROADMAP.md).
- [Licensing and asset terms](licensing.md), [character assets](character-assets.md),
  [third-party notices](../THIRD_PARTY_NOTICES.md), and
  [reviewed dependency backports](security-backports.md).

## Historical material

Files under [release history](releases/), dated `local-fixes-*` and `local-polish-*`
reports, [bug investigations](bugs/), [research](research/) and older
[implementation plans](plans/) preserve the evidence and decisions from their
recorded dates. A plan or old release note does not establish current support or
guarantee that an unresolved issue has been fixed.

Old issue numbers, release tags and private repository
links in historical notes refer to that original project, not to issues in the
new public CapriCore repository. For current installation and update advice,
use the guides above.
