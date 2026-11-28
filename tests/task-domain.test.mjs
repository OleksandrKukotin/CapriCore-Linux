// SPDX-License-Identifier: GPL-3.0-only
import test from 'node:test';
import assert from 'node:assert/strict';
import { standaloneCalculation, toolDomain } from '../apps/desktop/task-route.mjs';
import { isScientificExpression } from '../integrations/desktop-actions/math-expression.mjs';

test('standalone math accepts complete scientific expressions while preserving factorials and app wording', () => {
  for (const [request, expression] of [
    ['Calculate 3^4 + 6! - sqrt(949) via calculator', '3^4 + 6! - sqrt(949)'],
    ['Calculate 3**4 + factorial(6) - sqrt(949)', '3**4 + factorial(6) - sqrt(949)'],
    ['Calculate 6!', '6!'],
    ['Use calculator and calculate sqrt(5352) - ln(5)', 'sqrt(5352) - ln(5)'],
    ['6!!', '6!!'],
    ['Find log(8, 2) using the calculator.', 'log(8, 2)'],
    ['Please calculate (2 + 3) * (7 - 4) with calculator?', '(2 + 3) * (7 - 4)'],
    ['sqrt(25)!', 'sqrt(25)!'],
    ['sin(pi/2) + log1p(1)', 'sin(pi/2) + log1p(1)'],
    ['2pi + 3(4+5)', '2pi + 3(4+5)'],
    ['1e-3 + .25 × 4', '1e-3 + .25 × 4'],
    ['100 + 10%', '100 + 10%'],
    ['5 mod 2', '5 mod 2'],
    ['Calculate 3^4\n+ 6!', '3^4 + 6!'],
  ])
    assert.equal(standaloneCalculation(request), expression, request);
});

test('standalone math never consumes mixed tasks, prose, code or incomplete expressions', () => {
  for (const request of [
    'Calculate 3^4 + 6! - sqrt(949) via calculator and explain the result.',
    'Calculate 2+2 then open Notepad',
    'Use calculator and calculate 2+2 then open Notepad',
    'Type sqrt(25) in Chrome',
    'Remind me in 2+3 minutes',
    'My password is 1+2',
    '42',
    'Calculate sqrt',
    'Calculate sqrt()',
    'Calculate sqrt(25',
    'Calculate sqrt(,25)',
    'Calculate log(8,,2)',
    'Calculate 2 3',
    'Calculate 2+3)',
    'Calculate 1;2',
    'Calculate a=1',
    'Calculate [1,2]',
    'Calculate import(1)',
    'Calculate evaluate(1)',
    'Calculate sqrt.constructor(1)',
    'Calculate 3***4',
  ])
    assert.equal(standaloneCalculation(request), null, request);
  assert.equal(isScientificExpression('('.repeat(49) + '1' + ')'.repeat(49)), false);
  assert.equal(isScientificExpression('1+'.repeat(130) + '1'), false);
});
test('tool narrowing selects only available math domains without executing or rerouting file/time tasks', () => {
  const state = { applications: { calculator: true } };
  assert.equal(
    toolDomain('Open Google Chrome and type Capri in its search bar.', {
      ...state,
      fullComputerAccess: true,
    }),
    'desktop',
  );
  assert.equal(
    toolDomain('Type 2+2 in the Chrome address bar.', { ...state, fullComputerAccess: true }),
    'desktop',
  );
  assert.equal(
    toolDomain('What is the square root of one thousand thirty six?', state),
    'calculator',
  );
  assert.equal(toolDomain('Set the volume to 30%', {}), null);
  for (const value of [
    'Find the root directory of the file',
    'Set a timer for 2 plus 3 minutes',
    'Read the file square.txt',
  ])
    assert.equal(toolDomain(value, state), null, value);
});

test('computer access questions and repeated-permission complaints stay conversational', () => {
  const discussions = [
    'Why do you keep saying full computer access is off?',
    'No matter what I say, Capri keeps claiming that full computer access is missing.',
    'No matter what I say, Capri keeps claiming that "full computer access" is missing—even though I never asked her to enable anything.',
    'I never asked you to enable full computer access.',
    'I only questioned why you keep saying full computer access is off.',
    'What does full computer access do?',
    'How does computer control work?',
    'Do you have full computer access?',
    'Is full computer access enabled?',
    'Could you please explain full computer control?',
    'Can you control my PC?',
    'Do you have access to my computer?',
    'Capri, tell me what full computer access means.',
    'Stop repeating that full computer access is off.',
    'Why do you keep saying "enable full computer access"?',
  ];
  for (const fullComputerAccess of [false, true])
    for (const text of discussions)
      assert.equal(toolDomain(text, { fullComputerAccess }), 'conversation', text);
});

test('access discussion narrowing preserves genuine polite commands and mixed app tasks', () => {
  const requests = [
    'Enable full computer access.',
    'Could you please turn on full computer control?',
    'Can you enable full computer access and open Chrome?',
    'Could you open Chrome using full computer control?',
    'Disable full computer access.',
    'Use full computer control to open Chrome and click the first link.',
    'Open Chrome and explain what full computer access means.',
    'Why is full computer access off? Enable it and open Chrome.',
    'What does full computer access do? Could you please open Chrome?',
  ];
  for (const fullComputerAccess of [false, true])
    for (const text of requests)
      assert.equal(toolDomain(text, { fullComputerAccess }), 'desktop', text);
  assert.equal(toolDomain('Write "full computer access is off" in Notepad.', {}), null);
});
