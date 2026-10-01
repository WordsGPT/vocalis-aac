import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { findTopicPictogram, TOPIC_KEYWORD_MAP } from '../src/components/vocabulary.js';

test('findTopicPictogram maps keywords to authentic ARASAAC pictograms', () => {
  // Test direct keyword mapping
  assert.equal(findTopicPictogram('Mercado'), 35695);
  assert.equal(findTopicPictogram('queso'), 4610);
  assert.equal(findTopicPictogram('Cine'), 34320);
  assert.equal(findTopicPictogram('película'), 34320);
  assert.equal(findTopicPictogram('Médico'), 6561);
  assert.equal(findTopicPictogram('Hospital'), 6523);
  assert.equal(findTopicPictogram('Música'), 24791);
  assert.equal(findTopicPictogram('Familia'), 38351);

  // Test composite / subword matching
  assert.equal(findTopicPictogram('Ir al mercado'), 35695);
  assert.equal(findTopicPictogram('Comprar comida'), 8986);

  // Fallback for unmapped topics
  assert.equal(findTopicPictogram('Tema Desconocido Inexistente'), 6517);
  assert.equal(findTopicPictogram(''), 6517);
  assert.equal(findTopicPictogram(null), 6517);
});

test('CommunicationBoard renders topic chips and active topic heading', () => {
  const jsxPath = path.resolve('src/components/CommunicationBoard.jsx');
  const content = fs.readFileSync(jsxPath, 'utf8');

  // Must accept topics, activeTopic, and onSelectTopic
  assert.ok(content.includes('topics = []'), 'Must accept topics prop');
  assert.ok(content.includes('activeTopic = null'), 'Must accept activeTopic prop');
  assert.ok(content.includes('onSelectTopic'), 'Must accept onSelectTopic prop');

  // Must have aac-header-topics in header
  assert.ok(content.includes('aac-header-topics'), 'Must render aac-header-topics');
  assert.ok(content.includes('aac-topic-chip'), 'Must render aac-topic-chip');

  // Must have active topic indicator in reply heading
  assert.ok(content.includes('Volviendo a:'), 'Must show Volviendo a: header when activeTopic is set');
  assert.ok(content.includes('aac-active-topic-badge'), 'Must render aac-active-topic-badge to clear topic');
});

test('App.jsx manages conversation topics and focusTopic suggestion requests', () => {
  const appPath = path.resolve('src/App.jsx');
  const content = fs.readFileSync(appPath, 'utf8');

  assert.ok(content.includes('conversationTopics'), 'Must track conversationTopics state');
  assert.ok(content.includes('activeTopic'), 'Must track activeTopic state');
  assert.ok(content.includes('handleSelectTopic'), 'Must implement handleSelectTopic handler');
  assert.ok(content.includes('focusTopic'), 'Must pass focusTopic to getSmartSuggestions');
  assert.ok(content.includes('findTopicPictogram'), 'Must map pictograms using findTopicPictogram');
});

test('communication.css includes styles for topic chips in header', () => {
  const cssPath = path.resolve('src/components/communication.css');
  const css = fs.readFileSync(cssPath, 'utf8');

  assert.ok(css.includes('.aac-header-topics'), 'Must have .aac-header-topics CSS');
  assert.ok(css.includes('.aac-topic-chip'), 'Must have .aac-topic-chip CSS');
  assert.ok(css.includes('.aac-topic-chip.active'), 'Must have active topic styling');
  assert.ok(css.includes('.aac-active-topic-badge'), 'Must have .aac-active-topic-badge CSS');
});
