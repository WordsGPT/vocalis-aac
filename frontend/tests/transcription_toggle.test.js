import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('transcription toggle helper respects localStorage state', () => {
  const storage = new Map();
  const mockLocalStorage = {
    getItem: key => storage.has(key) ? storage.get(key) : null,
    setItem: (key, val) => storage.set(key, String(val)),
    removeItem: key => storage.delete(key),
  };

  function readShowTranscript(ls) {
    try {
      const saved = ls.getItem('vocalis_show_transcript');
      return saved !== null ? saved !== 'false' : true;
    } catch { return true; }
  }

  // Default when empty
  assert.equal(readShowTranscript(mockLocalStorage), true);

  // When saved as false
  mockLocalStorage.setItem('vocalis_show_transcript', 'false');
  assert.equal(readShowTranscript(mockLocalStorage), false);

  // When toggled to true
  mockLocalStorage.setItem('vocalis_show_transcript', 'true');
  assert.equal(readShowTranscript(mockLocalStorage), true);
});

test('CommunicationBoard source includes transcription toggle button and accessible controls', () => {
  const jsxPath = path.resolve('src/components/CommunicationBoard.jsx');
  const content = fs.readFileSync(jsxPath, 'utf8');

  // Must import Eye and EyeOff icons
  assert.ok(content.includes('Eye'), 'Must import Eye');
  assert.ok(content.includes('EyeOff'), 'Must import EyeOff');

  // Must have showTranscript state and toggleTranscript handler
  assert.ok(content.includes('showTranscript'), 'Must have showTranscript state');
  assert.ok(content.includes('toggleTranscript'), 'Must have toggleTranscript function');
  assert.ok(content.includes('vocalis_show_transcript'), 'Must persist choice to vocalis_show_transcript');

  // Must have conversation-toggle-transcript button in controls
  assert.ok(content.includes('id="conversation-toggle-transcript"'), 'Must have conversation-toggle-transcript button ID');
  assert.ok(content.includes('aria-controls="conversation-hearing"'), 'Must control conversation-hearing element');
  assert.ok(content.includes('aria-expanded={showTranscript}'), 'Must announce expanded state');

  // Must support hiding transcription section
  assert.ok(content.includes('id="conversation-hearing"'), 'Must have conversation-hearing ID');
  assert.ok(content.includes('hidden={!showTranscript}'), 'Must have hidden attribute bound to showTranscript state');

  // Must have inline close and reopen triggers
  assert.ok(content.includes('aac-hearing-close'), 'Must have header close button');
  assert.ok(content.includes('aac-show-hearing-btn'), 'Must have collapsed show button');
});

test('communication.css includes necessary rules for hidden hearing section and toggle styling', () => {
  const cssPath = path.resolve('src/components/communication.css');
  const css = fs.readFileSync(cssPath, 'utf8');

  assert.ok(css.includes('.aac-hearing[hidden]'), 'Must have rule for [hidden] attribute');
  assert.ok(css.includes('display: none !important'), 'Hidden section must be display: none !important');
  assert.ok(css.includes('.aac-hearing-header'), 'Must have hearing header styles');
  assert.ok(css.includes('.aac-hearing-close'), 'Must have hearing close styles');
  assert.ok(css.includes('.aac-hearing-collapsed'), 'Must have collapsed state styles');
  assert.ok(css.includes('.aac-show-hearing-btn'), 'Must have show button styles');
  assert.ok(css.includes('.aac-transcript-btn-extra'), 'Must have responsive label hiding');
});
