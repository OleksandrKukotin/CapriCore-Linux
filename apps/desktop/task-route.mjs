// SPDX-License-Identifier: GPL-3.0-only
import { companionDialogueQuestion, conversationOnly } from './conversation-route.mjs';
import {
  accessCommand,
  mentionsComputerMode,
  rejectsDesktopAction,
} from './computer-mode-request.mjs';
import { isScientificExpression } from '../../integrations/desktop-actions/math-expression.mjs';

const number = String.raw`-?\d{1,60}(?:\.\d{1,60})?`;
const root = new RegExp(
  String.raw`^(?:(?:square root of)\s+(${number})|(?:sqrt|√)\s*\(\s*(${number})\s*\)|√\s*(${number}))$`,
  'iu',
);

/** Route only a complete standalone expression. Mixed requests still go through the model. */
export function standaloneCalculation(text) {
  if (text.length > 280) return null;
  const value = text
    .trim()
    .replace(/^(?:capri)[, ]+\s*/iu, '')
    .replace(/^(?:(?:please\s+)?use\s+(?:the\s+)?calculator)(?:\s+and\s+|[,.:]\s*|\s+)/iu, '')
    .replace(/^(?:please\s+)?(?:(?:what is|what's|calculate|compute|find)\s+(?:the\s+)?)/iu, '')
    .replace(/[.?]+$/u, '')
    .replace(/\s+(?:(?:via|using|with)\s+(?:the\s+)?calculator)$/iu, '')
    .trim()
    .replace(/\s+/gu, ' ');
  const match = root.exec(value);
  if (match) return `sqrt(${match[1] ?? match[2] ?? match[3]})`;
  return /[+*/^!%()×÷π²³-]|\bmod\b/u.test(value) && isScientificExpression(value) ? value : null;
}

function computerAccessDiscussion(text) {
  const value = text
    .trim()
    .replace(/^(?:hey\s+)?capri[,\s:]+/iu, '')
    .replace(/^please[,\s]+/iu, '');
  if (
    /^(?:can|could|do)\s+you\s+(?:actually\s+)?(?:control|operate|use|have\s+access\s+to)\s+(?:(?:my|the|this)\s+)?(?:computer|pc|desktop)(?:\s+(?:right\s+)?now)?[?!.\s]*$/iu.test(
      value,
    )
  )
    return true;
  if (!mentionsComputerMode(text.replace(/["“”«»]/gu, '')) || accessCommand(text)) return false;
  const unquoted = text.replace(/"[^"\n]*"|“[^”\n]*”|«[^»\n]*»/gu, '');
  if (
    unquoted
      .split(/[?？;.!]\s*/u)
      .slice(1)
      .some((part) => {
        const command = part
          .trim()
          .replace(/^(?:please)[,\s]+/iu, '')
          .replace(/^(?:can|could|would)\s+you\s+(?:please\s+)?/iu, '');
        return (
          accessCommand(part) ||
          /^(?:enable|disable|activate|deactivate|turn\s+(?:on|off)|open|launch|start|find|search|type|write|click|press|move|create|copy|delete|play|calculate)(?=\s)/iu.test(
            command,
          )
        );
      })
  )
    return false;
  // Discussing a permission is not an instruction to request it. Preserve the
  // positive command parser first, including polite questions such as "Could
  // you enable full computer access?", and leave unfamiliar app tasks alone.
  return (
    /^(?:what\s+(?:is|are|does|do|can|would|happens)|why\s+(?:do|does|did|are|is|have|would)|how\s+(?:does|do|is|can|would)|(?:do|did)\s+(?:you|i|we)|(?:is|are|was|were|has|have)\s|(?:can|could|would)\s+you\s+(?:please\s+)?(?:explain|describe|tell|say)|explain\s|describe\s|tell\s+me\s)/iu.test(
      value,
    ) ||
    /^(?:i\s+(?:(?:never|only|just)\s+(?:asked|wanted|said|questioned)|(?:did\s+not|didn['’]t)\s+ask)|you\s+(?:keep|always|continue)|no\s+matter\s+what\s+i\s+say|stop\s+(?:saying|telling|claiming|repeating|bringing\s+up))/iu.test(
      value,
    )
  );
}

/** Domain selection only. The model still chooses every action and argument. */
export function toolDomain(text, state, routing) {
  const value = String(text).normalize('NFKC');
  if (rejectsDesktopAction(value)) return 'conversation';
  if (computerAccessDiscussion(value)) return 'conversation';
  if (mentionsComputerMode(value)) return 'desktop';
  if (companionDialogueQuestion(value)) return 'conversation';
  const temporal = /\b(?:timer|stopwatch|remind|reminder|alarm|schedule)\b/iu.test(value);
  const mathematics =
    /(?:\d\s*[-+*/^%]\s*\d)|\b(?:sqrt|square|squared|cube|cubed|root|logarithm|logarithmic|sine|cosine|tangent|factorial|plus|minus|divided by|multiplied by|calculate)\b/iu.test(
      value,
    );
  const nonMath =
    /\b(?:file|folder|directory|path|root access|root directory|square one|root for|root of the problem)\b/iu.test(
      value,
    );
  const browserTask =
    /\b(?:chrome|edge|browser|search bar|address bar)\b/iu.test(value) &&
    /\b(?:open|launch|start|type|write|enter|search|find|look up)\b/iu.test(value);
  if (!temporal && !nonMath && browserTask && state.fullComputerAccess) return 'desktop';
  if (
    !temporal &&
    !nonMath &&
    mathematics &&
    (state.applications?.calculator || state.fullComputerAccess)
  )
    return 'calculator';
  return conversationOnly(value, routing) ? 'conversation' : null;
}
