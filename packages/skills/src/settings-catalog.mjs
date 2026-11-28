// SPDX-License-Identifier: GPL-3.0-only
import { webSearchSettings } from './web-search/settings.mjs';
// UI metadata for the desktop's registered, user-facing skills. Port adapters
// such as speech-settings and file-access share their parent skill's page.
export const SKILL_SETTINGS = Object.freeze(
  [
    [
      'capri.microphone',
      'microphone',
      'Voice input',
      'Listen for the wake phrase and transcribe what you say.',
      'M8 4a2 2 0 0 1 4 0v5a2 2 0 0 1-4 0zM5 8v1a5 5 0 0 0 10 0V8m-5 6v4m-3 0h6',
      'microphone-toggle',
      true,
    ],
    [
      'capri.voice-output',
      'voice',
      'Spoken replies',
      'Read Capri’s replies aloud using a local voice or a voice API.',
      'M3 8h3l4-4v12l-4-4H3zm10-1a4 4 0 0 1 0 6m2-8a7 7 0 0 1 0 10',
      'voice-toggle',
      true,
    ],
    [
      'capri.reasoning',
      'reasoning',
      'Deep thinking',
      'Give Capri more time to work through difficult questions.',
      'M8 3H5L3 6v7l3 4h2l2-2 2 2h2l3-4V6l-2-3h-3l-2 2zm2 2v10M3 9h4l1 2m9-2h-4l-1 2',
      'thinking-toggle',
    ],
    [
      'capri.web-search',
      'web-search',
      'Web search',
      'Search the web for current information and show sources.',
      'M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0ZM3 10h14M10 3c4 4 4 10 0 14m0-14c-4 4-4 10 0 14',
      'internet-toggle',
    ],
    [
      'capri.owner-memory',
      'dialogue',
      'Conversation memory',
      'Remember facts you ask Capri to save and recall them in later conversations.',
      'M4 4h12v3H4zm0 5h12v3H4zm0 5h12v3H4zm3-9h1m-1 5h1m-1 5h1',
    ],
    [
      'capri.attachment-viewer',
      'attachments',
      'Attachments',
      'Attach files to messages and open previews from conversation history.',
      'M13 7l-5 5a2 2 0 0 0 3 3l6-6a4 4 0 0 0-6-6l-7 7a5 5 0 0 0 7 7l5-5',
    ],
    [
      'capri.timers',
      'time',
      'Timers and reminders',
      'Set timers, reminders and stopwatches.',
      'M10 5a6 6 0 1 1 0 12 6 6 0 0 1 0-12Zm-2-3h4m-2 3V2m0 6v3l2 1m3-7 2-2',
      'time-open',
    ],
    [
      'capri.screen',
      'screen',
      'Screen observation',
      'Describe or capture a display or window you explicitly share.',
      'M7 3H3v4m10-4h4v4M3 13v4h4m10-4v4h-4m0-7a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
      'screen-indicator',
    ],
    [
      'capri.applications',
      'applications',
      'Application access',
      'Launch and use apps you approve by name.',
      'M3 3h5v5H3zm9 0h5v5h-5zm-9 9h5v5H3zm9 0h5v5h-5z',
      'applications-open',
    ],
    [
      'capri.calculator',
      'calculator',
      'Calculator',
      'Check arithmetic and scientific calculations with a calculator.',
      'M5 2h10v16H5zm2 3h6v3H7zm0 6h1m4 0h1m-6 3h1m4 0h1',
    ],
    [
      'capri.avatar-interaction',
      'avatar-skill',
      'Avatar interaction',
      'Let Capri react to taps and respond to movement requests.',
      'M10 2l7 5-2 9-5 2-5-2-2-9zm-3 7 1 1m5-1-1 1m-4 3h4',
    ],
    [
      'capri.initiative',
      'initiative',
      'Initiative',
      'Let Capri start occasional conversations when appropriate.',
      'M10 2l2 5 5 2-5 2-2 5-2-5-5-2 5-2zm5 12h4m-2-2v4',
    ],
    [
      'capri.voice-calls',
      'calls',
      'Voice calls',
      'Mix Capri’s voice into calls or listen to system audio with your microphone.',
      'M5 6v5m3-7v9m4-9v9m3-7v5M3 15h14m-10 3h6',
    ],
    [
      'capri.computer',
      'computer',
      'Computer control',
      'Carry out approved desktop tasks with a visible control indicator.',
    ],
    [
      'capri.files',
      'files',
      'File access',
      'Read or edit files only in the folders you share.',
      'M2 5h6l2 2h8v10H2zm3 5h10m-10 3h6',
    ],
    [
      'capri.brain',
      'knowledge',
      'Local Brain',
      'Retrieve relevant excerpts from documents in your Brain folder.',
      'M4 4l6-2 6 2v10l-6 4-6-4zm6-2v16M4 9l6 3 6-3',
    ],
    [
      'capri.private-memory',
      'private-memory',
      'Private memory',
      'Keep sensitive notes in a password-protected vault.',
      'M5 9h10v8H5zm2 0V6a3 3 0 0 1 6 0v3m-3 3v2',
    ],
    [
      'capri.discord-presence',
      'discord',
      'Discord presence',
      'Display Capri as an activity in Discord.',
      'M5 4l3-1m4 0 3 1 3 10-4 2-2-3H8l-2 3-4-2zm2 5h1m4 0h1',
    ],
    [
      'capri.workflows',
      'workflows',
      'Task training',
      'Record and replay a workflow you teach Capri.',
      'M2 4h6v4H2zm10 0h6v4h-6zM7 13h6v4H7zm1-7h4m3 2v3h-5v2',
    ],
    [
      'capri.user-tools',
      'user-tools',
      'User tools',
      'Configure and run user-installed tools with their declared permissions.',
      'M8 2h4v3l3 2 3-1v5l-3 1-2 3v3H7v-3l-2-3-3-1V6l3 1 3-2zm2 6v4m-2-2h4',
    ],
  ].map(([id, section, name, description, icon, buttonId, showButton = false]) =>
    Object.freeze({
      id,
      section,
      name,
      description,
      buttonId,
      showButton,
      icon: icon ?? 'M2 4h16v10H2zm5 13h6m-3-3v3M6 9h3m3-2 2 2-2 2',
    }),
  ),
);

export const SKILL_BY_ID = Object.freeze(
  Object.fromEntries(SKILL_SETTINGS.map((skill) => [skill.id, skill])),
);
export const SKILL_BY_SECTION = Object.freeze(
  Object.fromEntries(SKILL_SETTINGS.map((skill) => [skill.section, skill])),
);
export const COMPOSER_SKILLS = Object.freeze({
  'capri.reasoning': 'thinking-toggle',
  'capri.web-search': 'internet-toggle',
  'capri.attachment-viewer': 'attachment-open',
});
export const REASONING_BUDGETS = Object.freeze({ low: 4096, medium: 8192, high: 16384 });
export function reasoningEffort(value) {
  return typeof value === 'string' && Object.hasOwn(REASONING_BUDGETS, value) ? value : 'medium';
}

export function showComposerSkill(settings, id) {
  const value = settings?.[id];
  return (
    Object.hasOwn(COMPOSER_SKILLS, id) && value?.enabled === true && value.showComposer !== false
  );
}

export function skillPreferences(value) {
  let search;
  try {
    search = webSearchSettings(value?.['capri.web-search']?.search);
  } catch {
    search = webSearchSettings();
  }
  return Object.fromEntries(
    SKILL_SETTINGS.map(({ id, showButton }) => [
      id,
      {
        enabled:
          typeof value?.[id]?.enabled === 'boolean'
            ? value[id].enabled
            : ['capri.avatar-interaction', 'capri.attachment-viewer'].includes(id),
        showButton:
          typeof value?.[id]?.showButton === 'boolean' ? value[id].showButton : showButton,
        ...(Object.hasOwn(COMPOSER_SKILLS, id)
          ? { showComposer: value?.[id]?.showComposer !== false }
          : {}),
        ...(id === 'capri.reasoning' ? { effort: reasoningEffort(value?.[id]?.effort) } : {}),
        ...(id === 'capri.web-search' ? { search } : {}),
        ...(id === 'capri.calculator' ? { showWindow: value?.[id]?.showWindow === true } : {}),
        ...(id === 'capri.owner-memory' ? { automatic: value?.[id]?.automatic === true } : {}),
      },
    ]),
  );
}
