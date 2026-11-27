// SPDX-License-Identifier: GPL-3.0-only
const steps = [
  { id: 'overview', target: '#portrait-panel', fallbackTarget: '#avatar-viewport, #handle' },
  { id: 'type', target: '.composer', fallbackTarget: '#input-dock' },
  {
    id: 'voice',
    target: '#input-microphone',
    fallbackTarget: '#microphone-toggle, .composer',
  },
  { id: 'replies', target: '#history-toggle', fallbackTarget: '#subtitle-stage, #handle' },
  {
    id: 'settings',
    target: '#settings-open',
    fallbackTarget: '#quick-actions',
    section: 'general',
  },
  {
    id: 'models',
    target: '#inference-picker',
    fallbackTarget: '#inference-label, #handle',
    panel: 'inference',
  },
  {
    id: 'local',
    target: '#inference-picker [data-settings="models"]',
    fallbackTarget: '#inference-label, #handle',
    panel: 'inference',
    section: 'models',
  },
  {
    id: 'api',
    target: '#inference-picker [data-settings="api"]',
    fallbackTarget: '#inference-label, #handle',
    panel: 'inference',
    section: 'api',
  },
];

const translations = {
  en: {
    kicker: 'CAPRI // GUIDE',
    beginnerTitle: '1. Getting started',
    beginnerDescription: 'Meet Capri, learn how to talk to her, and choose a language model.',
    close: 'Close guide',
    back: 'Back',
    next: 'Next',
    skip: 'Skip step',
    finish: 'Finish',
    stepLabel: (current, total) => `Step ${current} of ${total}`,
    statusUnavailable: 'I couldn’t open Settings. You can still use the gear to get there.',
    steps: {
      overview: {
        title: 'Hey, I’m Capri',
        description:
          'This is my main window. My portrait shows my current state, and the bar above it has the model picker and window controls. I’ll show you what you need for our first chat.',
      },
      type: {
        title: 'Send me a message',
        description:
          'Type here and press Enter or click the send arrow. Shift+Enter starts a new line. After the guide, try asking “What can you help me with?”',
      },
      voice: {
        title: 'Talk to me',
        description:
          'Enable Voice input in Settings, then click the mic beside the send arrow to speak. With the toolbar mic on, you can say “Hey, Capri” to get my attention. The Voice input page also lets you choose your microphone and recognition language.',
      },
      replies: {
        title: 'Find my replies',
        description:
          'My latest reply appears above my portrait. Use the speech bubble to read past messages, or the speaker button to turn my spoken replies on or off.',
      },
      settings: {
        title: 'Make me yours',
        description:
          'The gear opens Settings. Use Languages to change the interface or conversation language. In Skills you can turn individual features on and off.',
        actionLabel: 'Open Settings',
      },
      models: {
        title: 'See which model I’m using',
        description:
          'The label in the top bar shows my current model. Open it to switch between Local and any saved API connections. The menu shows which one is active.',
      },
      local: {
        title: 'Run a model on this PC',
        description:
          'Open Language model, pick a model that suits your hardware, and select Use local model. I’ll prepare it and download the model files if they’re missing.',
        actionLabel: 'Language model',
      },
      api: {
        title: 'Connect an API provider',
        description:
          'Open API connections and select Add an API connection. Choose a provider, then enter its model ID and API key. Save and select Use connection. Your chat requests go to that provider.',
        actionLabel: 'API connections',
      },
    },
  },
};

// The beginner guide is written in English only.
export function guideContent() {
  const { steps: localizedSteps, ...labels } = translations.en;
  return { ...labels, steps: steps.map((step) => ({ ...step, ...localizedSteps[step.id] })) };
}
