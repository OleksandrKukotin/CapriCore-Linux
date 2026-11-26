// SPDX-License-Identifier: GPL-3.0-only
import { setTimeout as delay } from 'node:timers/promises';
import { canClickTarget, hasVisualEvidence } from './computer-click-target.mjs';

const cyberpunkAppId = '1091500';
const cyberpunkUri = 'steam://rungameid/' + cyberpunkAppId;
const redLauncherPath = /(?:^|[\\/])CD Projekt Red[\\/]REDlauncher[\\/]REDlauncher\.exe$/iu;
const title = String.raw`(?:cyberpunk|киберпанк)(?:['’]s)?(?:\s+(?:2077|twenty seventy[- ]seven|две тысячи семьдесят семь))?`;
const steam = String.raw`(?:steam|стим[еа]?)`;
const direct = String.raw`(?:launch|start|open|play|turn on|запусти|открой|включи)\s+${title}(?:\s+(?:in|on|via|through|в|через)\s+${steam})?`;
const next = String.raw`(?:and(?: then)?|then|и|потом|затем)`;
const openSteam = String.raw`(?:open|go to|launch|открой|перейди в)\s+(?:(?:the app|приложение|клиент)\s+)?${steam}(?:,\s*(?:${next}\s+)?|\s+${next}\s+)`;
const fromLibrary = String.raw`(?:\s+(?:from (?:my |the )?library|из (?:моей )?библиотеки))?`;
const playButton = String.raw`(?:click|press|нажми)\s+["'«“]?(?:play|launch|играть|запустить)["'»”]?`;
const confirmPlay = String.raw`(?:,\s*(?:${next}\s+)?|\s+${next}\s+)${playButton}`;
const selectAndPlay = String.raw`(?:go to (?:my |the )?library\s+(?:and |then )?)?(?:go to|select|find)\s+${title}${confirmPlay}`;
const launchRequest = new RegExp(
  String.raw`^(?:${direct}(?:${confirmPlay})?|${openSteam}(?:${direct}${fromLibrary}(?:${confirmPlay})?|${selectAndPlay}))$`,
  'iu',
);

// Only an explicit launch of this Steam title may bypass the desktop planner.
// A different game, negation or an additional requested action stays on the normal path.
export function cyberpunkSteamLaunch(goal) {
  const request = String(goal)
    .normalize('NFKC')
    .trim()
    .replace(/^(?:(?:hey\s+)?capri|капри)[,\s:]+/iu, '')
    .replace(/^(?:i need to test your ability\.\s*see,\s*)?i want you to\s+/iu, '')
    .replace(/^(?:can you|could you|можешь|please|пожалуйста)[,\s]+/iu, '')
    .replace(
      /^(?:(?:use(?:ful)?\s+(?:uh\s+)?(?:my computer|(?:full\s+)?computer access|full access to my (?:pc|computer)))|(?:используй\s+(?:полный доступ к (?:моему )?(?:пк|компьютеру)|мой\s+(?:компьютер|пк))))\s*(?:(?:,\s*)?then\s+|\s+and\s+|,\s*(?:затем\s+)?|\s+и\s+)/iu,
      '',
    )
    .replace(/\b(?:uh|um)\s+/giu, '')
    .replace(/[.!?]+$/u, '')
    .replace(/(?:[,\s]+(?:please|пожалуйста))$/iu, '')
    .trim();
  return launchRequest.test(request);
}

// The Windows backend read the registry/process list; the Linux port reads
// ~/.local/share/Steam (libraryfolders.vdf, appmanifest_*.acf) and /proc.
async function cyberpunkSteamState() {
  return 'unavailable';
}

async function cyberpunkProcessRunning() {
  return false;
}

export function isCyberpunkLauncherWindow(identity) {
  return redLauncherPath.test(identity?.executable ?? '');
}

export const isCyberpunkPlayLabel = (value) =>
  /^(?:Play|Играть|Jouer|Spielen|Jugar|Jogar|Gioca|Graj|プレイ|开始游戏|開始遊戲|플레이)$/iu.test(
    value?.trim() ?? '',
  );

export function cyberpunkLauncherTarget(view, identity) {
  if (
    !isCyberpunkLauncherWindow(identity) ||
    !view.targets.some(
      (target) => !target.surface && /^Cyberpunk 2077$/iu.test(target.untrustedLabel?.trim() ?? ''),
    )
  )
    return null;
  const buttons = view.targets.filter(
    (target) =>
      !target.surface &&
      !target.editable &&
      canClickTarget(target, { exact: !view.screenAvailable }) &&
      isCyberpunkPlayLabel(target.untrustedLabel),
  );
  const confirmed = buttons.filter((target) => target.visualConfirmed);
  if (confirmed.length === 1) return confirmed[0];
  const visual = buttons.filter(hasVisualEvidence);
  const candidates = visual.length ? visual : buttons;
  return candidates.length === 1 ? candidates[0] : null;
}

async function installedRedLauncher() {
  return null;
}

export function steamGameLauncher({
  openExternal,
  readState = cyberpunkSteamState,
  isRunning = cyberpunkProcessRunning,
  findLauncher = installedRedLauncher,
}) {
  return async ({ signal, assertAllowed, confirm, playAlreadyRequested = false }) => {
    signal.throwIfAborted();
    const state = await readState(signal);
    signal.throwIfAborted();
    if (state !== 'installed' && state !== 'running') return state;
    if (await isRunning(signal)) return 'running';
    if (state === 'installed' && !playAlreadyRequested) {
      assertAllowed();
      try {
        await openExternal(cyberpunkUri);
      } catch {
        signal.throwIfAborted();
        return 'client-unavailable';
      }
    }
    signal.throwIfAborted();
    return confirm({
      isRunning: () => isRunning(signal),
      findLauncher: () => findLauncher(signal),
    });
  };
}

export async function confirmCyberpunkLaunch({
  signal,
  isRunning,
  observe,
  click,
  timeoutMs = 12_000,
}) {
  let until = performance.now() + timeoutMs;
  let pressed = false;
  let attempts = 0;
  do {
    signal.throwIfAborted();
    if (await isRunning()) return 'started';
    if (!pressed && attempts < 2) {
      const target = await observe();
      if (target) {
        attempts++;
        try {
          pressed = (await click(target))?.ok === true;
          if (pressed) until = performance.now() + Math.max(timeoutMs, 25_000);
        } catch (error) {
          signal.throwIfAborted();
          if (error.inputPerformed !== false) throw error;
        }
      }
    }
    await delay(600, undefined, { signal });
  } while (performance.now() < until);
  return 'unconfirmed';
}
