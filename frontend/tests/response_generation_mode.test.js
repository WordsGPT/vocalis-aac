import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

test('Response generation mode defaults to manual and includes auto toggle and prominent button', () => {
  const appSrc = fs.readFileSync(path.resolve('src/App.jsx'), 'utf-8');
  const boardSrc = fs.readFileSync(path.resolve('src/components/CommunicationBoard.jsx'), 'utf-8');
  const settingsSrc = fs.readFileSync(path.resolve('src/components/SettingsModal.jsx'), 'utf-8');
  const cssSrc = fs.readFileSync(path.resolve('src/components/communication.css'), 'utf-8');

  // 1. DEFAULT_SETTINGS in App.jsx should default responseGenerationMode to 'manual'
  assert.match(appSrc, /responseGenerationMode:\s*'manual'/);

  // 2. Settings parsing in App.jsx should default to 'manual'
  assert.match(appSrc, /responseGenerationMode:\s*stored\.responseGenerationMode_v2\s*\?\s*\(stored\.responseGenerationMode_v2\s*===\s*'auto'\s*\?\s*'auto'\s*:\s*'manual'\)\s*:\s*'manual'/);

  // 3. CommunicationBoard receives onUpdateSettings
  assert.match(appSrc, /onUpdateSettings=\{handleUpdateSettings\}/);

  // 4. CommunicationBoard contains prominent generate button and auto toggle switch
  assert.match(boardSrc, /aac-auto-toggle-btn/);
  assert.match(boardSrc, /aac-generate-prominent/);
  assert.match(boardSrc, /handleToggleAutoMode/);

  // 5. SettingsModal has manual as default option
  assert.match(settingsSrc, /value=\{settings\.responseGenerationMode \|\| 'manual'\}/);
  assert.match(settingsSrc, /<option value="manual">Manual/);

  // 6. CSS includes prominent button and auto toggle classes
  assert.match(cssSrc, /\.aac-generate-control-group/);
  assert.match(cssSrc, /\.aac-auto-toggle-btn/);
  assert.match(cssSrc, /\.aac-generate-prominent/);
  assert.match(cssSrc, /\.aac-auto-toggle-switch/);
});
