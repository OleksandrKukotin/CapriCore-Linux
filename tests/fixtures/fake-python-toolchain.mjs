// SPDX-License-Identifier: GPL-3.0-only
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { managedPython } from '../../packages/installer/src/python-runtime.mjs';
import voiceRuntime from '../../config/voice-runtime.json' with { type: 'json' };

const PATCH = { 3.11: '3.11.17', 3.12: '3.12.12' };

/**
 * Stand-in for uv and the component Pythons: records every command, creates
 * the files uv would create, and answers --version, the voice runtime selector
 * and the voice doctor. Nothing is downloaded or executed.
 */
export function fakePythonToolchain(
  folder,
  {
    onRun = () => {},
    venvVersion = '3.11.17',
    profile = 'legacy',
    doctor = { cuda: true, cudaCompute: { kernelReady: true } },
  } = {},
) {
  const uv = path.join(folder, 'fake-uv');
  const commands = [];
  const execute = async (file, args, options = {}) => {
    commands.push({ file, args, env: options.env });
    const say = (line) => options.output?.(line);
    if (file === uv && args[0] === 'python' && args[1] === 'install') {
      const version = args[2].split('-')[1];
      const python = managedPython(folder, version);
      mkdirSync(path.dirname(python), { recursive: true });
      writeFileSync(python, 'fixture');
    } else if (file === uv && args[0] === 'venv') {
      mkdirSync(path.join(args[1], 'bin'), { recursive: true });
      writeFileSync(path.join(args[1], 'bin/python'), 'fixture');
    } else if (args[0] === '--version') {
      const managed = /python(3\.\d+)$/.exec(file);
      say(`Python ${managed ? PATCH[managed[1]] : venvVersion}`);
    } else if (args.includes('tools/setup/select-voice-runtime.py')) {
      say(JSON.stringify({ profile, ...voiceRuntime.profiles[profile], devices: [] }));
    } else if (args.includes('doctor')) {
      say('Voice runtime check: loading PyTorch.');
      say(JSON.stringify(doctor));
    }
    await onRun(file, args, options);
  };
  const ran = (pattern) =>
    commands.filter(({ args }) => args.some((value) => pattern.test(String(value))));
  return { uv, execute, findUv: async () => uv, commands, ran };
}
