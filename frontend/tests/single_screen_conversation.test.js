import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('Conversation workspace stays bounded while replies remain readable and scroll when needed', () => {
  const cssPath = path.resolve('src/components/communication.css');
  const css = fs.readFileSync(cssPath, 'utf8');

  // Verify conversation workspace is strictly overflow: hidden and full height
  assert.ok(css.includes('.aac-scroll-area.aac-conversation-workspace'), 'Must target .aac-scroll-area.aac-conversation-workspace');
  assert.ok(css.includes('overflow: hidden !important'), 'Must enforce overflow: hidden !important');

  // Verify .aac-conversation is a full-height flex column
  assert.ok(css.includes('.aac-conversation {'), 'Must define .aac-conversation container');
  assert.ok(css.includes('display: flex'), 'Conversation must use flexbox');

  // Verify replies grid dynamically distributes rows with minmax(0, 1fr)
  assert.ok(css.includes('grid-template-rows: repeat(2, minmax(0, 1fr))'), 'Desktop grid must distribute rows as 1fr');
  assert.ok(css.includes('grid-template-rows: repeat(3, minmax(0, 1fr))'), 'Mobile grid must distribute 3 rows as 1fr');

  // Complete replies remain visible inside their cards.
  assert.ok(css.includes('.aac-conversation .aac-reply-text'), 'Must style .aac-reply-text');
  assert.ok(css.includes('-webkit-line-clamp: unset'), 'Must show complete reply text');
  assert.ok(css.includes('overflow-y: auto !important'), 'Reply list must scroll when space is limited');

  // Verify hearing section has bounded max-height
  assert.ok(css.includes('.aac-conversation .aac-hearing {'), 'Must target .aac-conversation .aac-hearing');
  assert.ok(css.includes('max-height: min('), 'Must clamp max-height of hearing section');
});

test('CommunicationBoard assigns aac-reply-text span and dynamic count classes', () => {
  const jsxPath = path.resolve('src/components/CommunicationBoard.jsx');
  const content = fs.readFileSync(jsxPath, 'utf8');

  assert.ok(content.includes('aac-reply-text'), 'CommunicationBoard must wrap reply text in aac-reply-text span');
  assert.ok(content.includes('aac-count-'), 'CommunicationBoard must apply aac-count- class to aac-replies container');
});

test('CommunicationBoard places Sí and No buttons directly adjacent to conversation suggestions', () => {
  const jsxPath = path.resolve('src/components/CommunicationBoard.jsx');
  const content = fs.readFileSync(jsxPath, 'utf8');

  // Must have dedicated quick Sí and No buttons
  assert.ok(content.includes('id="conversation-quick-yes"'), 'Must have conversation-quick-yes button');
  assert.ok(content.includes('id="conversation-quick-no"'), 'Must have conversation-quick-no button');
  assert.ok(content.includes("onSpeak('Sí'"), 'Sí button must trigger onSpeak with Sí');
  assert.ok(content.includes("onSpeak('No'"), 'No button must trigger onSpeak with No');
  assert.ok(content.includes('Picto id={5584}'), 'Sí button must use ARASAAC picto 5584');
  assert.ok(content.includes('Picto id={5526}'), 'No button must use ARASAAC picto 5526');

  const cssPath = path.resolve('src/components/communication.css');
  const css = fs.readFileSync(cssPath, 'utf8');

  assert.ok(css.includes('.aac-reply-quick-actions'), 'Must have .aac-reply-quick-actions');
  assert.ok(css.includes('.aac-quick-reply-btn'), 'Must have .aac-quick-reply-btn');
  assert.ok(css.includes('.aac-quick-yes'), 'Must style .aac-quick-yes affirmative pill');
  assert.ok(css.includes('.aac-quick-no'), 'Must style .aac-quick-no negation pill');
});
