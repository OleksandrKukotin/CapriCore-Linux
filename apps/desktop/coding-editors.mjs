// SPDX-License-Identifier: GPL-3.0-only
import { readdir, realpath, stat } from 'node:fs/promises';
import path from 'node:path';

// Launcher names as installed by distribution packages, tarballs, JetBrains
// Toolbox scripts, Snap and Flatpak exports.
const editors = [
  ['VS Code', 'vscode', ['code', 'com.visualstudio.code']],
  ['VS Code Insiders', 'vscode', ['code-insiders']],
  ['Cursor', 'vscode', ['cursor']],
  ['Windsurf', 'vscode', ['windsurf']],
  ['VSCodium', 'vscode', ['codium', 'vscodium', 'com.vscodium.codium']],
  ['VSCodium Insiders', 'vscode', ['codium-insiders']],
  [
    'IntelliJ IDEA',
    'jetbrains',
    ['idea', 'idea.sh', 'intellij-idea-community', 'intellij-idea-ultimate'],
  ],
  ['PyCharm', 'jetbrains', ['pycharm', 'pycharm.sh', 'pycharm-community', 'pycharm-professional']],
  ['WebStorm', 'jetbrains', ['webstorm', 'webstorm.sh']],
  ['Rider', 'jetbrains', ['rider', 'rider.sh']],
  ['CLion', 'jetbrains', ['clion', 'clion.sh']],
  ['GoLand', 'jetbrains', ['goland', 'goland.sh']],
  ['PhpStorm', 'jetbrains', ['phpstorm', 'phpstorm.sh']],
  ['RubyMine', 'jetbrains', ['rubymine', 'rubymine.sh']],
  ['DataGrip', 'jetbrains', ['datagrip', 'datagrip.sh']],
  ['DataSpell', 'jetbrains', ['dataspell', 'dataspell.sh']],
  ['RustRover', 'jetbrains', ['rustrover', 'rustrover.sh']],
  ['Android Studio', 'jetbrains', ['android-studio', 'studio', 'studio.sh']],
  ['Sublime Text', 'sublime', ['subl', 'sublime_text', 'com.sublimetext.three']],
  ['Neovim GUI', 'neovim', ['nvim-qt', 'neovide']],
  ['Emacs client', 'emacs', ['emacsclient']],
];
const editorByExecutable = new Map(
  editors.flatMap(([name, kind, files]) => files.map((file) => [file, { name, kind }])),
);

function localPath(value) {
  if (typeof value !== 'string' || value.length > 4096) return null;
  if (!path.isAbsolute(value) || /[\x00-\x1f]/.test(value)) return null;
  return path.normalize(value);
}

function localPaths(values) {
  return [...new Set(values.map(localPath).filter(Boolean))];
}

function readEntries(directory) {
  return readdir(directory, { withFileTypes: true }).catch(() => []);
}

/** Directories that hold editor launchers, without traversing arbitrary trees. */
export function editorDirectories(env = process.env) {
  const home = localPath(env.HOME);
  return localPaths([
    ...(env.PATH ?? '').split(path.delimiter).slice(0, 96),
    home && path.join(home, '.local/bin'),
    home && path.join(home, '.local/share/JetBrains/Toolbox/scripts'),
    home && path.join(home, '.local/share/flatpak/exports/bin'),
    '/var/lib/flatpak/exports/bin',
    '/snap/bin',
  ]);
}

async function foundExecutables(directories) {
  const result = [];
  for (let i = 0; i < directories.length; i += 24) {
    const matches = await Promise.all(
      directories
        .slice(i, i + 24)
        .map(async (directory) =>
          (await readEntries(directory))
            .filter(
              (entry) =>
                (entry.isFile() || entry.isSymbolicLink()) && editorByExecutable.has(entry.name),
            )
            .map((entry) => path.join(directory, entry.name)),
        ),
    );
    result.push(...matches.flat());
  }
  return result;
}

/** Metadata-only discovery. No editor process, login or plugin is started. */
export async function discoverCodingEditors(env = process.env) {
  const result = new Map();
  for (const candidate of await foundExecutables(editorDirectories(env))) {
    const editor = editorByExecutable.get(path.basename(candidate));
    try {
      // Package launchers are usually links into /opt or /usr/share; record the target.
      const executable = localPath(await realpath(candidate));
      const info = executable && (await stat(executable));
      if (!info?.isFile() || (info.mode & 0o111) === 0) continue;
      const key = editor.name + '\0' + executable;
      if ([...result.values()].some((item) => item.executable === executable)) continue;
      result.set(key, { name: editor.name, kind: editor.kind, executable });
      if (result.size >= 64) break;
    } catch {
      // An uninstalled, stale or inaccessible candidate does not hide other editors.
    }
  }
  return [...result.values()];
}
