// SPDX-License-Identifier: GPL-3.0-only
import { cyberpunkSteamLaunch } from './steam-game-launch.mjs';
import { edgerunnersTeaserRequest } from './edgerunners-teaser.mjs';
import { callTaskRequest } from './call-computer-task.mjs';
import { youtubeHomeDestination } from './browser-search-state.mjs';
import { steamGameCommand } from './steam-task-state.mjs';

// Fast paths for common requests. Ambiguous and other-language requests can use
// the desktop intent classifier without starting an ordinary chat turn.
const englishMode = String.raw`(?:full\s+(?:computer|pc|desktop)\s+(?:control|access)|full\s+(?:control|access)\s+(?:of|to|over)\s+(?:(?:my|the|this|entire|whole)\s+)*(?:computer|pc|desktop)|computer\s+control)(?:\s+mode)?`;
const mode = englishMode;
const prefix = /^(?:(?:hi|hey|hello)[,\s]+)?(?:capr[ie])[,.!\s:]+/iu;
const accessStatusQuestions = [
  new RegExp(
    String.raw`^(?:(?:do you (?:currently )?have|have you got) (?:${englishMode})|is (?:the )?${englishMode}(?: (?:enabled|active|on))?)[.?]*$`,
    'iu',
  ),
  /^(?:(?:voc[eê] |tu )?(?:tem|tens|est[aá] com)|(?:me (?:diz|diga)|pode me dizer) se (?:voc[eê] )?tem) acesso (?:total|completo) (?:ao(?: meu| seu)?|à(?: minha| sua)?) (?:computador|pc|m[aá]quina)[.?]*$/iu,
];

export function computerAccessStatusQuestion(text) {
  const request = text.normalize('NFKC').trim().replace(prefix, '').replace(/\s+/gu, ' ');
  return accessStatusQuestions.some((pattern) => pattern.test(request));
}

const polite = /^(?:(?:please)[,\s]+|(?:can|could|would)\s+you\s+(?:please\s+)?)/iu;
const enable = new RegExp(
  String.raw`^(?:enable|activate|turn\s+on|switch\s+to|use)\s+(?:the\s+)?${mode}(?=$|[\s,.:;!?])`,
  'iu',
);
const disable = new RegExp(
  String.raw`^(?:disable|deactivate|turn\s+off|revoke)\s+(?:the\s+)?${mode}(?=$|[\s,.:;!?])`,
  'iu',
);
const using = new RegExp(String.raw`^(?:using|with|in)\s+${mode}(?=$|[\s,.:;!?])`, 'iu');
const trailing = new RegExp(String.raw`\s+(?:using|with)\s+${mode}[.!?\s]*$`, 'iu');
const action =
  /^(?:open|launch|start|find|search|type|write|click|move|create|copy|delete|play|calculate)(?=\s)/iu;
const mention = new RegExp(String.raw`(?:^|\s)${mode}(?=$|[\s,.:;!?])`, 'iu');
const spanishMode = String.raw`(?:control|acceso) (?:total|completo) (?:del?|al?|sobre) (?:(?:el|la|mi|tu) )?(?:ordenador|computadora?|equipo|pc)`;
const settingId = String.raw`(?:fullComputerAccess?|"fullComputerAccess?"|“fullComputerAccess?”|«fullComputerAccess?»)`;
const spanishModeChange = new RegExp(
  String.raw`^[¿¡]?\s*(?:por favor[,\s]+)?(?:(?:puedes|podr[ií]as)\s+)?(?:(?<enable>activ(?:a|ar)|habilit(?:a|ar)|enciende|encender)|desactiv(?:a|ar)|deshabilit(?:a|ar)|apaga|apagar|revoc(?:a|ar))\s+(?:el\s+)?(?:${spanishMode}|${settingId})(?:\s+para (?:empezar|comenzar))?(?:,?\s+por favor)?[.!?\s]*$`,
  'iu',
);
const accessTask =
  /(?:^|[\s,])(?:use|using|with)\s+(?:uh\s+)?(?:(?:my|your|the)\s+)?computer\s+access(?=\s|[.!?,]|$)/iu;
const taskCommand = /^(?:open|launch|start|search|find|google|use)(?=\s)/iu;
const requestText = (text) =>
  String(text)
    .normalize('NFKC')
    .trim()
    .replace(prefix, '')
    .replace(/^(?:hi|hey|hello)[,!.]\s+/iu, '')
    .replace(/^(?:so|okay)[,:]\s+/iu, '')
    .replace(polite, '')
    .replace(/^(?:i\s+(?:want|need|would\s+like)\s+you\s+to\s+)/iu, '')
    .replace(/^(?:uh|um|please)\s+/iu, '');

const openReference = /^(?:(?:and\s+)?then\s+)?(?:open|launch|start)\s+(?:it|that)[.!?\s]*$/iu;
const computerAppReference = (text) => openReference.test(requestText(text));
export const rejectsDesktopAction = (text) =>
  /^(?:do\s+not|don['’]t|never)\s+(?:enable|activate|turn\s+on|open|launch|start|use|click|press)(?!\p{L})/iu.test(
    requestText(text),
  );

const recoveredMode =
  /^(?:useful\s+(?:computer|pc|desktop)\s+(?:access|control)|use\s+my\s+(?:computer|pc|desktop)\s+via\s+full\s+access)(?=\s|[,.:;!?]|$)/iu;
const personalComputer =
  /^(?:use\s+(?:my|the|this)\s+(?:computer|pc|desktop)(?:\s+to\s+|\s*[,;:]\s*))/iu;
const personalComputerCommand = (request) => {
  const match = personalComputer.exec(request);
  if (!match) return null;
  const task = request.slice(match[0].length);
  return action.test(task) ? task : null;
};
const launchPrefix =
  /^(?:open|launch|start|abre|abrir|inicia|iniciar|lanza|lanzar|ouvre|ouvrez|ouvrir|lance|lancez|lancer|démarre|démarrez|démarrer)\s+/iu;
const chainSeparator =
  /(?:[,.;:!?]\s*(?:(?:then|puis|ensuite)\s+)?|\s+(?:and\s+(?:then\s+)?|then\s+|et\s+(?:(?:puis|ensuite)\s+)?|puis\s+|ensuite\s+))(?=(?:go\s+to|switch\s+to|click|open|launch|search|find|google|type|write|press|show|play|do|close|quit|va|ouvre|ouvrez|lance|lancez|clique|cliquez|cherche|recherche|tape|écris|ferme|quitte)(?:\s|$))/iu;
const section = String.raw`(?:library|settings|preferences|downloads|history|inbox|biblioth[eè]que|param[eè]tres|pr[eé]f[eé]rences|t[eé]l[eé]chargements|historique)`;
const sectionFirst = new RegExp(
  String.raw`^(?:(?:the|my|la|les|ma|mes)\s+)?(${section})\s+(?:(?:in|of|dans|de)\s+)?(.+)$`,
  'iu',
);
const sectionLast = new RegExp(String.raw`^(.+?)\s+(${section})$`, 'iu');
const appName = /^[\p{L}\p{N}][\p{L}\p{N} ._+&'’\-]{0,79}$/u;
const clientName = (name) =>
  name.replace(/^(?:l['’](?:application|appli)|le client|the (?:app|application|client))\s+/iu, '');

export function computerTaskCommand(text) {
  const request = requestText(text).replace(
    /^(?:(?:por\s+favor|s['’]il (?:te|vous) plaît)[,\s]+|(?:puedes|podrías|peux-tu|pourrais-tu|pouvez-vous)\s+)/iu,
    '',
  );
  const access = enable.exec(request) ?? using.exec(request);
  const command = access
    ? request.slice(access[0].length)
    : (personalComputerCommand(request) ?? request.replace(recoveredMode, ''));
  return command
    .replace(/^[,.:;\s]+/u, '')
    .replace(/^(?:and|to)\s+/iu, '')
    .replace(trailing, '');
}

/** Keep desktop tools available for indirect owner requests, even after a classifier miss. */
export function computerModelCandidate(text) {
  const unquoted = computerTaskCommand(text).replace(/"[^"\n]*"|“[^”\n]*”|«[^»\n]*»/gu, '');
  const desktopMention = /\b(?:steam|discord|window|taskbar|browser|desktop|computer|app)\b/iu;
  const ownerRequest =
    /^(?:i (?:need|want|would like)|open|start|play|show|put|make|use|help)\s|\b(?:can you|could you|would you|for me|take care of)\b/iu;
  return (
    !rejectsDesktopAction(text) &&
    (/^(?:click|drag|minimi[sz]e|maximi[sz]e|bring up|switch to|launch)\s/iu.test(unquoted) ||
      (desktopMention.test(unquoted) && ownerRequest.test(unquoted)))
  );
}

export function ownerAppLaunch(text) {
  const command = computerTaskCommand(text);
  if (steamGameCommand(command)) return { name: 'Steam', single: false };
  if (!launchPrefix.test(command) || computerAppReference(command)) return null;
  const remainder = command.replace(launchPrefix, '');
  const separator = remainder.search(chainSeparator);
  let name = (separator < 0 ? remainder : remainder.slice(0, separator))
    .replace(/[.!?]+$/u, '')
    .replace(/(?:\s+please|,?\s+(?:s['’]il (?:te|vous) plaît))$/iu, '')
    .trim()
    .replace(
      /^(?:"([^"]+)"|«([^»]+)»|“([^”]+)”)$/u,
      (_, straight, french, curly) => straight ?? french ?? curly,
    );
  const before = sectionFirst.exec(name),
    after = before ? null : sectionLast.exec(name);
  const destination = before?.[1] ?? after?.[2];
  const literalName = name;
  name = clientName(before?.[2] ?? after?.[1] ?? name);
  if (!appName.test(name)) return null;
  if (destination)
    return {
      name,
      single: false,
      section: destination,
      literalName,
      ...(separator < 0 && { sectionOnly: true }),
    };
  const appWithoutType = name.replace(/\s+(?:app(?:lication)?|window)$/iu, '');
  if (appWithoutType !== name && appName.test(appWithoutType))
    return { name: appWithoutType, single: separator < 0, literalName: name };
  return { name, single: separator < 0 };
}

/** Resolve an app substitution only after an explicit, single-app launch. */
export function ownerAppLaunchFollowUp(text, previous) {
  if (!previous || !ownerAppLaunch(previous)?.single) return null;
  const name =
    /^(?:(?:o+k+a*y*|never\s*mind)[,.!\s]+)*(?:and\s+)?(?:what|how)\s+about\s+(.+?)[?!.\s]*$/iu.exec(
      requestText(text),
    )?.[1];
  if (
    !name ||
    !appName.test(name) ||
    !/[\p{Lu}\p{N}]/u.test(name) ||
    /\b(?:and|then|instead|before|after|to)\b/iu.test(name)
  )
    return null;
  return 'Open ' + name;
}

export const computerTaskFollowUp = (text) =>
  computerAppReference(text) ||
  /^(?:continue(?:\s+(?:the|that|this)\s+task)?[.!?\s]*$|(?:open|load|show)\s+(?:(?:your|my|the|that|this)\s+)?(?:(?:most\s+)?(?:recent|latest)\s+)?project\b|(?:export|render)\s+(?:it|that|this|the project|the video)\b)/iu.test(
    requestText(text),
  );

// Keep the settings and desktop tools available for semantic paraphrases, without
// treating a mere mention as permission or starting a session.
export const mentionsComputerMode = (text) => mention.test(String(text).normalize('NFKC'));

export function exactClickLabel(text) {
  const request = requestText(text);
  const access = enable.exec(request) ?? using.exec(request) ?? recoveredMode.exec(request);
  const command = (access ? request.slice(access[0].length) : request)
    .replace(/^[,.:;\s]+/u, '')
    .replace(/^(?:and|to)\s+/iu, '')
    .replace(trailing, '');
  return (
    /^(?:click|press|clique(?:z)? sur|pulsa|haz clic en)\s+(?:(?:the\s+)?button\s+)?(?:"([^"\r\n]{1,100})"|«([^»\r\n]{1,100})»|“([^”\r\n]{1,100})”)[.!?\s]*$/iu
      .exec(command)
      ?.slice(1)
      .find(Boolean)
      ?.trim() || null
  );
}

/** Music playback is a dedicated skill, not an implicit request for a GUI session. */
export function windowsMediaPlayerTask(text) {
  const command = computerTaskCommand(text).replace(/"[^"\n]*"|“[^”\n]*”|«[^»\n]*»/gu, 'track');
  if (/\b(?:spotify|youtube)\b/iu.test(command)) return false;
  return /^(?:play|pause|resume|stop|skip|shuffle|put\s+on)\s+[^.!?;\n]{0,150}\b(?:from|in|on)\s+(?:(?:my|the)\s+)?(?:windows(?:['’]s?)?\s+)?media\s+player[.!\s]*$/iu.test(
    command,
  );
}

// This is only an application anchor for semantic routing, never permission or
// an action classifier. Keep translated product names usable with any language.
export const mentionsDiscord = (text) =>
  /\bdiscord\b|ディスコード|디스코드|迪斯科德|狄斯科德|ديسكورد|דיסקורד|डिस्कॉर्ड/iu.test(
    String(text).normalize('NFKC'),
  );

function authorizedDiscordCommand(text) {
  // A quoted command is data. Questions and less familiar phrasing go through
  // the multilingual intent classifier, including polite action questions.
  const unquoted = String(text)
    .normalize('NFKC')
    .replace(/"[^"\n]*"|“[^”\n]*”|«[^»\n]*»/gu, '');
  const addressed = unquoted.trim().replace(prefix, '');
  if (
    !mentionsDiscord(unquoted) ||
    /[?？]|^(?:(?:can|could|would)\s+you(?!\p{L}))/iu.test(addressed)
  )
    return false;
  const command = requestText(unquoted);
  if (/^(?:join|connect|leave|disconnect|navigate|go\s+to|switch\s+to)(?=\s)/iu.test(command))
    return true;
  return (
    /^(?:send|post|type|write)(?=\s)/iu.test(command) &&
    /\b(?:in|into|to|on)\s+(?:the\s+)?discord\b/iu.test(command)
  );
}

// Route an already-authorized app sequence as one goal. An address-bar draft
// remains a single narrow action.
function authorizedSequence(value) {
  const unquoted = value.replace(/"[^"\n]*"|“[^”\n]*”|«[^»\n]*»/gu, '');
  const command = requestText(unquoted);
  const browser = /\b(?:chrome|edge|browser|computer\s+control)\b/iu;
  const app = /\b(?:discord|davinci\s+resolve)\b/iu;
  const nextNavigation =
    /(?:,\s*|\b(?:and(?:\s+then)?|then|after\s+(?:this|that)|next|finally)\s+)(?:(?:please|uh|um)\s+)*(?:go\s+to|click|open|search|find|google|show|display|press|navigate|watch|export)(?=\s)/iu;
  return (
    taskCommand.test(command) &&
    ((accessTask.test(unquoted) &&
      /\b(?:open|search|google|find|launch|turn\s+on|go\s+to)\b/iu.test(command)) ||
      (/^(?:open|launch|start)\s/iu.test(command) && nextNavigation.test(unquoted)) ||
      ((browser.test(unquoted) || app.test(unquoted)) && nextNavigation.test(unquoted)) ||
      (app.test(unquoted) &&
        /\b(?:uh|um)\s+(?:go\s+to|open|click|type|press|export)\s/iu.test(command)) ||
      (/^(?:search|find|google)\s/iu.test(command) && browser.test(unquoted)))
  );
}

export function computerModeRequest(text, { fullComputerAccess = false } = {}) {
  if (callTaskRequest(text)) return { enabled: true, run: true };
  const value = requestText(text);
  const spanish = spanishModeChange.exec(value);
  if (spanish) return { enabled: Boolean(spanish.groups.enable), run: false };
  const off = disable.exec(value);
  if (off && !value.slice(off[0].length).replace(/[\s.!?,;:]/g, ''))
    return { enabled: false, run: false };
  const on = enable.exec(value) ?? using.exec(value);
  if (on) {
    const remaining = value
      .slice(on[0].length)
      .replace(/^[\s,.:;!?]*(?:please|now)?[\s,.:;!?]*$/iu, '')
      .trim();
    return { enabled: true, run: Boolean(remaining) };
  }
  if (personalComputerCommand(value)) return { enabled: true, run: true };
  // Common voice transcription of "use full"; require an actual task after it.
  const recovered = recoveredMode.exec(value);
  if (recovered) {
    const command = value
      .slice(recovered[0].length)
      .replace(/^[,.:;\s]+/u, '')
      .replace(/^(?:and|to)\s+/iu, '');
    if (action.test(command) || /^(?:do|switch|press|navigate|go)\s/iu.test(command))
      return { enabled: true, run: true };
  }
  if (action.test(value) && trailing.test(value)) return { enabled: true, run: true };
  if (fullComputerAccess && windowsMediaPlayerTask(value)) return { enabled: true, run: true };
  if (fullComputerAccess) {
    if (youtubeHomeDestination(computerTaskCommand(value))) return { enabled: true, run: true };
    if (authorizedDiscordCommand(text)) return { enabled: true, run: true };
    if (exactClickLabel(text)) return { enabled: true, run: true };
    if (cyberpunkSteamLaunch(value) || edgerunnersTeaserRequest(value))
      return { enabled: true, run: true };
    const opening = ownerAppLaunch(value);
    const browserDraft =
      opening && /^(?:google chrome|chrome|edge|microsoft edge|browser)$/iu.test(opening.name);
    if (authorizedSequence(value) || (opening && (opening.single || !browserDraft)))
      return { enabled: true, run: true };
  }
  return null;
}
