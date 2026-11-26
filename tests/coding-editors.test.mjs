// SPDX-License-Identifier: GPL-3.0-only
import assert from 'node:assert/strict';
import {
  mkdirSync,
  mkdtempDisposableSync,
  realpathSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { discoverCodingEditors, editorDirectories } from '../apps/desktop/coding-editors.mjs';

function launcher(root, relative, mode = 0o755) {
  const file = path.join(root, relative);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, '#!/bin/sh\n# Metadata-only editor fixture; never executed\n', { mode });
  return file;
}

test('Find editors covers PATH, ~/.local/bin, Toolbox scripts and Flatpak exports', async () => {
  using temporary = mkdtempDisposableSync(path.join(tmpdir(), 'capri-editors-'));
  const root = temporary.path;
  const home = path.join(root, 'home');
  const code = launcher(root, 'usr/bin/code');
  const idea = launcher(home, '.local/share/JetBrains/Toolbox/scripts/idea');
  const subl = launcher(home, '.local/bin/subl');
  const codium = launcher(home, '.local/share/flatpak/exports/bin/com.vscodium.codium');
  launcher(root, 'usr/bin/not-an-editor');
  const editors = await discoverCodingEditors({ PATH: path.join(root, 'usr/bin'), HOME: home });
  const found = Object.fromEntries(editors.map((editor) => [editor.executable, editor]));
  assert.deepEqual(found[realpathSync(code)], {
    name: 'VS Code',
    kind: 'vscode',
    executable: realpathSync(code),
  });
  assert.equal(found[realpathSync(idea)]?.kind, 'jetbrains');
  assert.equal(found[realpathSync(subl)]?.kind, 'sublime');
  assert.equal(found[realpathSync(codium)]?.name, 'VSCodium');
  assert.equal(editors.length, 4);
});

test('Find editors records a package link by its target, once, and skips non-executables', async () => {
  using temporary = mkdtempDisposableSync(path.join(tmpdir(), 'capri-editors-'));
  const root = temporary.path;
  const target = launcher(root, 'opt/visual-studio-code/bin/code');
  mkdirSync(path.join(root, 'bin'));
  mkdirSync(path.join(root, 'usr/local/bin'), { recursive: true });
  symlinkSync(target, path.join(root, 'bin/code'));
  symlinkSync(target, path.join(root, 'usr/local/bin/code'));
  launcher(root, 'usr/bin/cursor', 0o644);
  symlinkSync(path.join(root, 'missing/codium'), path.join(root, 'bin/codium'));
  const editors = await discoverCodingEditors({
    PATH: [
      path.join(root, 'bin'),
      path.join(root, 'usr/local/bin'),
      path.join(root, 'usr/bin'),
    ].join(':'),
  });
  assert.deepEqual(editors, [
    { name: 'VS Code', kind: 'vscode', executable: realpathSync(target) },
  ]);
});

test('Editor directories ignore relative and malformed PATH entries and stay bounded', () => {
  const directories = editorDirectories({
    PATH: ['relative/bin', '/usr/bin', '/usr/bin', '/bad\nentry', ...Array(200).fill('/x')].join(
      ':',
    ),
    HOME: '/home/owner',
  });
  assert.ok(directories.includes('/usr/bin'));
  assert.equal(directories.filter((value) => value === '/usr/bin').length, 1);
  assert.ok(!directories.some((value) => !path.isAbsolute(value) || /\n/.test(value)));
  for (const expected of [
    '/home/owner/.local/bin',
    '/home/owner/.local/share/JetBrains/Toolbox/scripts',
    '/home/owner/.local/share/flatpak/exports/bin',
    '/var/lib/flatpak/exports/bin',
    '/snap/bin',
  ])
    assert.ok(directories.includes(expected), expected);
  assert.deepEqual(editorDirectories({ HOME: 'relative' }), [
    '/var/lib/flatpak/exports/bin',
    '/snap/bin',
  ]);
});
