#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-only
/**
 * Install one speech component into this Capri folder. Replaces the Windows
 * `setup-*.cmd` / `setup-*.ps1` launchers.
 *
 *   node tools/setup/setup.mjs recognition [en|fast-multi|multi]
 *   node tools/setup/setup.mjs router
 *   node tools/setup/setup.mjs voice [--profile auto|legacy|blackwell|amd] [--dependencies-only] [--plan-only]
 *   node tools/setup/setup.mjs multilingual [--language all|<code>]
 *   node tools/setup/setup.mjs multilingual-voice [--language all|<code>]
 *   node tools/setup/setup.mjs qwen [--russian] [--dependencies-only]
 *
 * Progress goes to stdout as JSON lines ({"stage":...}); tool output to stderr.
 */
import path from 'node:path';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { installationLock } from '../../packages/installer/src/lock.mjs';
import { noLinks } from '../../packages/installer/src/policy.mjs';
import { speechSetup } from '../../packages/installer/src/speech-setup.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    profile: { type: 'string', default: 'auto' },
    language: { type: 'string', default: 'all' },
    'dependencies-only': { type: 'boolean', default: false },
    'plan-only': { type: 'boolean', default: false },
    russian: { type: 'boolean', default: false },
  },
});
const [component, argument] = positionals;
const controller = new AbortController();
for (const name of ['SIGINT', 'SIGTERM', 'SIGHUP'])
  process.once(name, () => controller.abort(new Error('Setup cancelled')));

const cache = path.join(root, '.runtime/installer');
noLinks(cache);
mkdirSync(cache, { recursive: true });
let release;
try {
  release = installationLock(cache);
  const setup = speechSetup({
    root,
    signal: controller.signal,
    stage: (stage) => console.log(JSON.stringify({ stage })),
    output: (line) => console.error(line),
  });
  const dependenciesOnly = values['dependencies-only'];
  const tasks = {
    recognition: () => setup.recognition(argument ?? 'en'),
    router: () => setup.router(),
    voice: () =>
      setup.voice({ profile: values.profile, dependenciesOnly, planOnly: values['plan-only'] }),
    multilingual: () => setup.multilingual(values.language),
    'multilingual-voice': () => setup.multilingualVoice(values.language),
    qwen: () => setup.qwen({ russian: values.russian, dependenciesOnly }),
  };
  if (!tasks[component]) {
    console.error(`Usage: node tools/setup/setup.mjs <${Object.keys(tasks).join('|')}> [options]`);
    process.exitCode = 2;
  } else {
    await tasks[component]();
    console.log(JSON.stringify({ stage: 'ready' }));
  }
} catch (error) {
  console.error(error?.message ?? String(error));
  process.exitCode = error?.code === 'CAPRI_ROUTER_NATIVE_LIBRARY_UNAVAILABLE' ? 22 : 1;
} finally {
  release?.();
}
