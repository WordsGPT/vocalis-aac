import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('Mobile UI architecture enforces docked bottom navigation and flex order', () => {
  const cssPath = path.resolve('src/components/communication.css');
  const css = fs.readFileSync(cssPath, 'utf8');

  // Must have mobile media query
  assert.ok(css.includes('@media (max-width: 768px)'), 'Must include 768px mobile media query');

  // Mobile App shell flex column
  assert.ok(css.includes('flex-direction: column !important'), 'aac-app must be column flexbox on mobile');
  assert.ok(css.includes('order: 1 !important'), 'Header must be order: 1');
  assert.ok(css.includes('order: 3 !important'), 'Scroll area must be order: 3');
  assert.ok(css.includes('order: 4 !important'), 'Navigation must be order: 4 (docked at bottom)');

  // Bottom navigation styling
  assert.ok(css.includes('grid-template-columns: repeat(4, 1fr) !important'), 'Tabs must be 4 equal columns on mobile');
  assert.ok(css.includes('env(safe-area-inset-bottom'), 'Bottom nav must respect safe-area-inset-bottom');

  // Quick bar hidden in conversation mode on mobile
  assert.ok(css.includes('.aac-app:has(.aac-conversation-workspace) .aac-navigation .aac-quick'), 'Must target quick bar in conversation workspace');
});

test('Mobile header is streamlined with icon-only actions and horizontal topic strip', () => {
  const cssPath = path.resolve('src/components/communication.css');
  const css = fs.readFileSync(cssPath, 'utf8');

  // Header sizing and icon tools
  assert.ok(css.includes('.aac-header .aac-voice-label'), 'Must hide voice label on mobile');
  assert.ok(css.includes('.aac-header-actions'), 'Must style .aac-header-actions container');
  assert.ok(css.includes('.aac-header-topics'), 'Must style .aac-header-topics horizontal scroll');

  const jsxPath = path.resolve('src/components/CommunicationBoard.jsx');
  const jsx = fs.readFileSync(jsxPath, 'utf8');
  assert.ok(jsx.includes('aac-header-actions'), 'CommunicationBoard must group header tools in aac-header-actions');
});

test('Mobile conversation view provides touch-friendly replies grid and direct quick actions', () => {
  const cssPath = path.resolve('src/components/communication.css');
  const css = fs.readFileSync(cssPath, 'utf8');

  // Mobile replies 2x3 grid
  assert.ok(css.includes('grid-template-columns: repeat(2, minmax(0, 1fr)) !important'), 'Mobile replies must use 2 columns');
  assert.ok(css.includes('grid-template-rows: repeat(3, minmax(0, 1fr)) !important'), 'Mobile replies must use 3 rows');

  // Reply cards tap-to-speak and edit button
  assert.ok(css.includes('.aac-conversation .aac-reply-speak'), 'Must style mobile reply speak button');
  assert.ok(css.includes('.aac-conversation .aac-reply-edit'), 'Must style mobile reply edit button');
  assert.ok(css.includes('.aac-reply-quick-actions'), 'Must style quick direct actions');
  assert.ok(css.includes('.aac-quick-reply-btn'), 'Must style quick reply button');

  // Compact phones query
  assert.ok(css.includes('@media (max-width: 480px)'), 'Must include 480px extra compact query');
});

test('Mobile board view scales pictograms, core strip, and folder categories for phones', () => {
  const cssPath = path.resolve('src/components/communication.css');
  const css = fs.readFileSync(cssPath, 'utf8');

  assert.ok(css.includes('.aac-core-strip'), 'Must style .aac-core-strip on mobile');
  assert.ok(css.includes('.aac-folders'), 'Must style .aac-folders on mobile');
  assert.ok(css.includes('.aac-tile-grid'), 'Must style .aac-tile-grid on mobile');
});

test('Modals support mobile bottom-sheet presentation and safe-area inset', () => {
  const contextPath = path.resolve('src/components/ContextModal.jsx');
  const contextJsx = fs.readFileSync(contextPath, 'utf8');
  assert.ok(contextJsx.includes('items-end sm:items-center'), 'ContextModal must adapt backdrop alignment for mobile');
  assert.ok(contextJsx.includes('safe-area-inset-bottom'), 'ContextModal footer must use safe-area-inset-bottom');

  const settingsPath = path.resolve('src/components/SettingsModal.jsx');
  const settingsJsx = fs.readFileSync(settingsPath, 'utf8');
  assert.ok(settingsJsx.includes('items-end sm:items-center'), 'SettingsModal must adapt backdrop alignment for mobile');
  assert.ok(settingsJsx.includes('safe-area-inset-bottom'), 'SettingsModal footer must use safe-area-inset-bottom');
});
