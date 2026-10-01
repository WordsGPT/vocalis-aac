import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('CommunicationBoard includes header context button and conditional conversation chip', () => {
  const jsxPath = path.resolve('src/components/CommunicationBoard.jsx');
  const content = fs.readFileSync(jsxPath, 'utf8');

  // Must import User icon
  assert.ok(content.includes('User'), 'CommunicationBoard must import User icon');

  // Must accept onOpenContext
  assert.ok(content.includes('onOpenContext'), 'CommunicationBoard must accept onOpenContext prop');

  // Must have header-context-btn in the header
  assert.ok(content.includes('id="header-context-btn"'), 'Must have header-context-btn in header');
  assert.ok(content.includes('aac-context-tool'), 'Must have aac-context-tool class on context button');
  assert.ok(content.includes('aac-context-dot'), 'Must render aac-context-dot when context is present');

  // Must have conversation-context-chip in conversation view
  assert.ok(content.includes('id="conversation-context-chip"'), 'Must have conversation-context-chip');
  assert.ok(content.includes('aac-context-chip'), 'Must have aac-context-chip styling class');
});

test('ContextModal component has accessible dialog, input, shortcuts and templates', () => {
  const modalPath = path.resolve('src/components/ContextModal.jsx');
  assert.ok(fs.existsSync(modalPath), 'ContextModal.jsx file must exist');
  const content = fs.readFileSync(modalPath, 'utf8');

  assert.ok(content.includes('role="dialog"'), 'ContextModal must have role=dialog');
  assert.ok(content.includes('aria-modal="true"'), 'ContextModal must be aria-modal=true');
  assert.ok(content.includes('user-context-textarea'), 'ContextModal must have user-context-textarea id');
  assert.ok(content.includes('Guardar contexto'), 'ContextModal must have save button');
  assert.ok(content.includes('insertTemplate'), 'ContextModal must have template quick starters');
  assert.ok(content.includes('onSaveContext'), 'ContextModal must call onSaveContext');
});

test('communication.css includes necessary rules for context button and chip', () => {
  const cssPath = path.resolve('src/components/communication.css');
  const css = fs.readFileSync(cssPath, 'utf8');

  assert.ok(css.includes('.aac-context-tool'), 'CSS must style .aac-context-tool');
  assert.ok(css.includes('.aac-context-tool.has-context'), 'CSS must style active state .has-context');
  assert.ok(css.includes('.aac-context-dot'), 'CSS must style .aac-context-dot');
  assert.ok(css.includes('.aac-context-chip'), 'CSS must style .aac-context-chip');
});

test('autoTriggerDelay defaults to 1000ms (1.0s) across App, useSpeechRecognition and SettingsModal', () => {
  const appPath = path.resolve('src/App.jsx');
  const appContent = fs.readFileSync(appPath, 'utf8');
  assert.ok(appContent.includes('autoTriggerDelay: 1000'), 'DEFAULT_SETTINGS must have autoTriggerDelay: 1000');
  assert.ok(appContent.includes('autoTriggerDelay === 1500'), 'App must migrate legacy 1500ms delay to 1000ms');

  const hookPath = path.resolve('src/hooks/useSpeechRecognition.js');
  const hookContent = fs.readFileSync(hookPath, 'utf8');
  assert.ok(hookContent.includes('autoTriggerDelay = 1000'), 'useSpeechRecognition hook must default autoTriggerDelay to 1000');

  const settingsPath = path.resolve('src/components/SettingsModal.jsx');
  const settingsContent = fs.readFileSync(settingsPath, 'utf8');
  assert.ok(settingsContent.includes('(settings.autoTriggerDelay || 1000)'), 'SettingsModal must fallback to 1000');
});

test('ContextModal retains focus while typing by excluding text from focus-trap effect dependencies', () => {
  const modalPath = path.resolve('src/components/ContextModal.jsx');
  const content = fs.readFileSync(modalPath, 'utf8');

  // Must not have [isOpen, text] dependency array which causes focus to reset on every keystroke
  assert.ok(!content.includes('[isOpen, text]'), 'useEffect must not depend on text, which causes blur on every keystroke');
  assert.ok(content.includes('textRef'), 'Must use textRef to read latest text without re-running effect on every keystroke');
});

test('Partner correction form expands gracefully and focuses input in conversation mode', () => {
  const jsxPath = path.resolve('src/components/CommunicationBoard.jsx');
  const jsx = fs.readFileSync(jsxPath, 'utf8');

  assert.ok(jsx.includes('partnerDetailsRef'), 'Must have partnerDetailsRef');
  assert.ok(jsx.includes('partnerInputRef'), 'Must have partnerInputRef');
  assert.ok(jsx.includes('has-partner-open'), 'Must add has-partner-open class when open');
  assert.ok(jsx.includes('Escribir o corregir'), 'Must provide Escribir o corregir trigger');

  const cssPath = path.resolve('src/components/communication.css');
  const css = fs.readFileSync(cssPath, 'utf8');

  assert.ok(css.includes('.has-partner-open'), 'CSS must expand .has-partner-open');
  assert.ok(css.includes('.aac-conversation .aac-partner-input form'), 'CSS must style partner form in conversation mode');
});
