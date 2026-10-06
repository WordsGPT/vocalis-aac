import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  fetchAgentState,
  processAgentMessage,
  setAgentLight,
  addAgentCalendarEvent,
  deleteAgentCalendarEvent,
  updateAgentContext
} from '../src/services/api.js';

test('AgentPanel.jsx renders smart light demo, calendar demo, and editable memory context', () => {
  const panelPath = path.resolve('src/components/AgentPanel.jsx');
  const content = fs.readFileSync(panelPath, 'utf8');

  // 1. Smart light demo
  assert.ok(content.includes('agent-smart-light-bulb'), 'Must render smart light bulb element');
  assert.ok(content.includes('agent-toggle-light-btn'), 'Must render light toggle button');
  assert.ok(content.includes('turn the light on'), 'Must include turn the light on test prompt');
  assert.ok(content.includes('green'), 'Must support green light state');

  // 2. Calendar demo
  assert.ok(content.includes('calendarEvents'), 'Must accept and render calendarEvents');
  assert.ok(content.includes('onAddCalendarEvent'), 'Must accept onAddCalendarEvent callback');
  assert.ok(content.includes('onDeleteCalendarEvent'), 'Must accept onDeleteCalendarEvent callback');
  assert.ok(content.includes('Nuevo evento'), 'Must have new event action');

  // 3. User context / memory editing
  assert.ok(content.includes('agent-edit-context-btn'), 'Must have button to edit user context / memory');
  assert.ok(content.includes('userContext'), 'Must display current user context');
  assert.ok(content.includes('onOpenContextModal'), 'Must connect to context modal');
});

test('CommunicationBoard.jsx includes agent tab, header light button, and action banner', () => {
  const boardPath = path.resolve('src/components/CommunicationBoard.jsx');
  const content = fs.readFileSync(boardPath, 'utf8');

  // Agent tab in tabs
  assert.ok(content.includes("['agent', Sparkles, 'Agente']"), 'Must register agent tab');
  assert.ok(content.includes("<AgentPanel"), 'Must render AgentPanel component');

  // Header light indicator button
  assert.ok(content.includes('id="header-light-btn"'), 'Must have header-light-btn');
  assert.ok(content.includes('aac-light-tool'), 'Must have aac-light-tool class');

  // Conversation agent action banner
  assert.ok(content.includes('aac-agent-action-banner'), 'Must render agent action banner in conversation');
  assert.ok(content.includes('lastAgentAction'), 'Must condition action banner on lastAgentAction');
});

test('App.jsx wires agent state, tool execution, and user context updates', () => {
  const appPath = path.resolve('src/App.jsx');
  const content = fs.readFileSync(appPath, 'utf8');

  assert.ok(content.includes('agentLight'), 'Must manage agentLight state');
  assert.ok(content.includes('calendarEvents'), 'Must manage calendarEvents state');
  assert.ok(content.includes('handleToggleLight'), 'Must have handleToggleLight');
  assert.ok(content.includes('handleAddCalendarEvent'), 'Must have handleAddCalendarEvent');
  assert.ok(content.includes('handleDeleteCalendarEvent'), 'Must have handleDeleteCalendarEvent');
  assert.ok(content.includes('handleProcessAgentCommand'), 'Must have handleProcessAgentCommand');

  // Tool execution from suggestions and speak
  assert.ok(content.includes('res.tool_calls'), 'Must check tool_calls in suggestion response');
  assert.ok(content.includes('res.updated_user_context'), 'Must update user context when agent edits it');
  assert.ok(content.includes('processAgentMessage'), 'Must call processAgentMessage on speak');
});

test('api.js exports agent communication functions', () => {
  assert.equal(typeof fetchAgentState, 'function');
  assert.equal(typeof processAgentMessage, 'function');
  assert.equal(typeof setAgentLight, 'function');
  assert.equal(typeof addAgentCalendarEvent, 'function');
  assert.equal(typeof deleteAgentCalendarEvent, 'function');
  assert.equal(typeof updateAgentContext, 'function');

  const apiPath = path.resolve('src/services/api.js');
  const content = fs.readFileSync(apiPath, 'utf8');
  assert.ok(content.includes('${API_BASE}/agent/state'), 'Must call /api/agent/state');
  assert.ok(content.includes('${API_BASE}/agent/process'), 'Must call /api/agent/process');
  assert.ok(content.includes('${API_BASE}/agent/light'), 'Must call /api/agent/light');
  assert.ok(content.includes('${API_BASE}/agent/calendar'), 'Must call /api/agent/calendar');
});
