import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { getOfflineSuggestions } from '../src/services/api.js';

test('CommunicationBoard renders speak mode button and active heading in conversation mode', () => {
  const jsxPath = path.resolve('src/components/CommunicationBoard.jsx');
  const content = fs.readFileSync(jsxPath, 'utf8');

  // Must accept speakMode and onToggleSpeakMode props
  assert.ok(content.includes('speakMode = false'), 'Must accept speakMode prop');
  assert.ok(content.includes('onToggleSpeakMode = () => {}'), 'Must accept onToggleSpeakMode prop');

  // Must render conversation-speak-mode button
  assert.ok(content.includes('id="conversation-speak-mode"'), 'Must render #conversation-speak-mode button');
  assert.ok(content.includes('aac-speak-mode-btn'), 'Must have aac-speak-mode-btn class');
  assert.ok(content.includes('Modo hablar'), 'Must have Modo hablar label');

  // Must show speak mode heading and badge
  assert.ok(content.includes('Qué quieres decir · Dirigir'), 'Must render speak mode heading');
  assert.ok(content.includes('aac-speak-mode-badge'), 'Must render aac-speak-mode-badge');
});

test('App.jsx tracks cursor movement to prevent suggestions from updating while cursor is moving', () => {
  const appPath = path.resolve('src/App.jsx');
  const content = fs.readFileSync(appPath, 'utf8');

  // Must have cursor movement tracking refs and listeners
  assert.ok(content.includes('isCursorMovingRef'), 'Must have isCursorMovingRef to track cursor movement');
  assert.ok(content.includes('cursorStopTimerRef'), 'Must have cursorStopTimerRef to debounce stillness');
  assert.ok(content.includes('pendingUpdateRef'), 'Must have pendingUpdateRef to hold deferred suggestions');
  assert.ok(content.includes("addEventListener('mousemove'"), 'Must listen to mousemove events');
  assert.ok(content.includes("addEventListener('pointermove'"), 'Must listen to pointermove events');

  // Must defer updates when cursor is moving or hovering replies
  assert.ok(content.includes('isCursorMovingRef.current || isHoveringRepliesRef.current'), 'Must check if cursor is moving or hovering before updating');
});

test('Callback feature enriches focusTopic with previous conversation context', () => {
  const appPath = path.resolve('src/App.jsx');
  const content = fs.readFileSync(appPath, 'utf8');

  assert.ok(content.includes('activeTopicContext'), 'Must track activeTopicContext');
  assert.ok(content.includes('topicContext'), 'Must pass topicContext to getSmartSuggestions');
  assert.ok(content.includes('historySliceLimit'), 'Must provide expanded history slice when focusing on a topic');

  const boardPath = path.resolve('src/components/CommunicationBoard.jsx');
  const boardContent = fs.readFileSync(boardPath, 'utf8');
  assert.ok(boardContent.includes('activeTopicContext'), 'CommunicationBoard must accept activeTopicContext');
  assert.ok(boardContent.includes('aac-topic-context-hint'), 'CommunicationBoard must render aac-topic-context-hint');
});

test('api.js getOfflineSuggestions and getSmartSuggestions support speak mode and topic context', () => {
  const apiPath = path.resolve('src/services/api.js');
  const content = fs.readFileSync(apiPath, 'utf8');

  assert.ok(content.includes("mode = 'reply'"), 'getSmartSuggestions must accept mode parameter');
  assert.ok(content.includes('topicContext = null'), 'getSmartSuggestions must accept topicContext parameter');
  assert.ok(content.includes('mode: mode || \'reply\''), 'Must serialize mode in suggest payload');
  assert.ok(content.includes('topic_context: topicContext || null'), 'Must serialize topic_context in suggest payload');

  // Test getOfflineSuggestions in speak mode
  const speakOffline = getOfflineSuggestions(4, 'masculine', 'speak');
  assert.equal(speakOffline.suggestions.length, 4);
  assert.ok(speakOffline.suggestions.some(s => s.toLowerCase().includes('propuesta') || s.toLowerCase().includes('idea') || s.toLowerCase().includes('opino') || s.toLowerCase().includes('iniciativa')));

  // Test getOfflineSuggestions in reply mode
  const replyOffline = getOfflineSuggestions(4, 'masculine', 'reply');
  assert.equal(replyOffline.suggestions.length, 4);
  assert.ok(replyOffline.suggestions[0].includes('Sí'));
});

test('communication.css includes necessary rules for speak mode button, badge, and topic context hint', () => {
  const cssPath = path.resolve('src/components/communication.css');
  const css = fs.readFileSync(cssPath, 'utf8');

  assert.ok(css.includes('.aac-speak-mode-btn'), 'Must style .aac-speak-mode-btn');
  assert.ok(css.includes('.aac-speak-mode-btn.is-active'), 'Must style .aac-speak-mode-btn.is-active');
  assert.ok(css.includes('.aac-speak-mode-dot'), 'Must style .aac-speak-mode-dot');
  assert.ok(css.includes('.aac-speak-mode-badge'), 'Must style .aac-speak-mode-badge');
  assert.ok(css.includes('.aac-topic-context-hint'), 'Must style .aac-topic-context-hint');
});
