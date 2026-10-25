import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Responsive geometry and complete text are checked in redesign.browser.cjs
// and ui.browser.cjs against real rendered pages, rather than CSS substrings.

test('CommunicationBoard assigns aac-reply-text span and dynamic count classes', () => {
  const jsxPath = path.resolve('src/components/CommunicationBoard.jsx');
  const content = fs.readFileSync(jsxPath, 'utf8');

  assert.ok(content.includes('aac-reply-text'), 'CommunicationBoard must wrap reply text in aac-reply-text span');
  assert.ok(content.includes('aac-count-'), 'CommunicationBoard must apply aac-count- class to aac-replies container');
});

test('CommunicationBoard places Sí, No, and Repeat buttons directly adjacent to conversation suggestions', () => {
  const jsxPath = path.resolve('src/components/CommunicationBoard.jsx');
  const content = fs.readFileSync(jsxPath, 'utf8');

  // Must have dedicated quick Sí, No, and Repeat buttons
  assert.ok(content.includes('id="conversation-quick-yes"'), 'Must have conversation-quick-yes button');
  assert.ok(content.includes('id="conversation-quick-no"'), 'Must have conversation-quick-no button');
  assert.ok(content.includes("onSpeak(directYes || 'Sí'"), 'Sí button must trigger onSpeak with directYes or Sí fallback');
  assert.ok(content.includes("onSpeak(directNo || 'No'"), 'No button must trigger onSpeak with directNo or No fallback');
  assert.ok(content.includes("¿Puedes repetir"), 'Repeat button must trigger onSpeak with repeat prompt');
  assert.ok(content.includes('Picto id={5584}'), 'Sí button must use ARASAAC picto 5584');
  assert.ok(content.includes('Picto id={5526}'), 'No button must use ARASAAC picto 5526');
  assert.ok(content.includes('Picto id={11752}'), 'Repeat button must use ARASAAC picto 11752');

  const cssPath = path.resolve('src/components/communication.css');
  const css = fs.readFileSync(cssPath, 'utf8');

  assert.ok(css.includes('.aac-reply-quick-actions'), 'Must have .aac-reply-quick-actions');
  assert.ok(css.includes('.aac-quick-reply-btn'), 'Must have .aac-quick-reply-btn');
  assert.ok(css.includes('.aac-quick-yes'), 'Must style .aac-quick-yes affirmative pill');
  assert.ok(css.includes('.aac-quick-no'), 'Must style .aac-quick-no negation pill');
  assert.ok(css.includes('.aac-quick-repeat'), 'Must style .aac-quick-repeat pill');
});
