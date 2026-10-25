import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

test('Planning modes: VisualPlanner and GuidedPlanner tabs and features', () => {
  const visualSrc = fs.readFileSync(path.resolve('src/components/VisualPlanner.jsx'), 'utf-8');
  const guidedSrc = fs.readFileSync(path.resolve('src/components/GuidedPlanner.jsx'), 'utf-8');
  const boardSrc = fs.readFileSync(path.resolve('src/components/CommunicationBoard.jsx'), 'utf-8');
  const apiSrc = fs.readFileSync(path.resolve('src/services/api.js'), 'utf-8');
  const cssSrc = fs.readFileSync(path.resolve('src/components/communication.css'), 'utf-8');

  // 1. VisualPlanner features (User's technique)
  assert.match(visualSrc, /RECIPIENTS/);
  assert.match(visualSrc, /PICTO_CATEGORIES/);
  assert.match(visualSrc, /handleToggleItem/);
  assert.match(visualSrc, /handleGenerateContinuations/);
  assert.match(visualSrc, /aac-tray-chips/);
  assert.match(visualSrc, /aac-continuations-grid/);
  assert.match(visualSrc, /aac-planned-script-panel/);

  // 2. GuidedPlanner features (Agent's technique)
  assert.match(guidedSrc, /GOAL_PRESETS_BY_RECIPIENT/);
  assert.match(guidedSrc, /fetchGuidedStoryboard/);
  assert.match(guidedSrc, /aac-storyboard-stages/);
  assert.match(guidedSrc, /aac-stage-option-card/);
  assert.match(guidedSrc, /isLiveMode/);
  assert.match(guidedSrc, /aac-live-giant-speak-btn/);
  assert.match(guidedSrc, /aac-live-emergency-bar/);

  // 3. CommunicationBoard includes both tabs in navigation
  assert.match(boardSrc, /'planner-visual',\s*Layers,\s*'Plan Visual'/);
  assert.match(boardSrc, /'planner-guided',\s*BookOpen,\s*'Guión Guiado'/);
  assert.match(boardSrc, /<VisualPlanner/);
  assert.match(boardSrc, /<GuidedPlanner/);
  assert.match(boardSrc, /plannedPhrases/);
  assert.match(boardSrc, /plannedRecipient/);

  // 4. API exports
  assert.match(apiSrc, /export async function fetchPlanContinuations/);
  assert.match(apiSrc, /export async function fetchGuidedStoryboard/);

  // 5. CSS styles
  assert.match(cssSrc, /\.aac-visual-planner/);
  assert.match(cssSrc, /\.aac-guided-planner/);
  assert.match(cssSrc, /\.aac-recipient-grid/);
  assert.match(cssSrc, /\.aac-live-giant-speak-btn/);
  assert.match(cssSrc, /\.aac-emergency-buttons/);
});
