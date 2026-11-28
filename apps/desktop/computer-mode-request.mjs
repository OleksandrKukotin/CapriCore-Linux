// SPDX-License-Identifier: GPL-3.0-only

// Phrase helpers for the Full computer access grant. Only fixed status questions
// are answered locally; every other request goes to the model with its tools.
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
const mention = new RegExp(String.raw`(?:^|\s)${mode}(?=$|[\s,.:;!?])`, 'iu');
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
const spanishMode = String.raw`(?:control|acceso) (?:total|completo) (?:del?|al?|sobre) (?:(?:el|la|mi|tu) )?(?:ordenador|computadora?|equipo|pc)`;
const settingId = String.raw`(?:fullComputerAccess?|"fullComputerAccess?"|“fullComputerAccess?”|«fullComputerAccess?»)`;
const spanishModeChange = new RegExp(
  String.raw`^[¿¡]?\s*(?:por favor[,\s]+)?(?:(?:puedes|podr[ií]as)\s+)?(?:(?<enable>activ(?:a|ar)|habilit(?:a|ar)|enciende|encender)|desactiv(?:a|ar)|deshabilit(?:a|ar)|apaga|apagar|revoc(?:a|ar))\s+(?:el\s+)?(?:${spanishMode}|${settingId})(?:\s+para (?:empezar|comenzar))?(?:,?\s+por favor)?[.!?\s]*$`,
  'iu',
);
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

export const rejectsDesktopAction = (text) =>
  /^(?:do\s+not|don['’]t|never)\s+(?:enable|activate|turn\s+on|open|launch|start|use|click|press)(?!\p{L})/iu.test(
    requestText(text),
  );

export const mentionsComputerMode = (text) => mention.test(String(text).normalize('NFKC'));

/** True when the text is an explicit command to change or use Full computer access. */
export function accessCommand(text) {
  const value = requestText(text);
  if (spanishModeChange.test(value)) return true;
  if (disable.test(value) || enable.test(value) || using.test(value)) return true;
  return action.test(value) && trailing.test(value);
}
