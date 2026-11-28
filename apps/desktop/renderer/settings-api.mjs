// SPDX-License-Identifier: GPL-3.0-only
// Only draft saves participate in the leave-settings barrier. Actions that wait
// for a confirmation consult that barrier themselves.
const draftMethods = {
  setSpeechSettings: 'speech-panel',
  setCompanionSettings: 'companion-settings',
  savePersonality: 'companion-settings',
  setLanguages: 'language-panel',
  setVoiceEffects: 'voice-effects-panel',
  setInitiative: 'initiative-panel',
};
const revisionGroups = {
  setCompanionSettings: 'companion',
  setLanguages: 'languages',
  setSpeechSettings: 'speech',
  setInitiative: 'initiative',
};
export function settingsApi(raw, { writes, revisions, saved }) {
  return new Proxy(
    { ...raw },
    {
      get(target, key) {
        const fn = target[key],
          panel = draftMethods[key];
        if (!panel || typeof fn !== 'function') return fn;
        return (...args) => {
          const group = revisionGroups[key];
          const result = group ? fn(args[0], revisions()[group]) : fn(...args);
          const task = Promise.resolve(result).then((value) => {
            if (group) {
              revisions()[group] = value.revision;
              value = value.settings;
            }
            saved(panel);
            return value;
          });
          writes.add(task);
          task.finally(() => writes.delete(task)).catch(() => {});
          return task;
        };
      },
    },
  );
}
