import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { logConversationTurn, fetchAuditLogs, exportAuditTranscript, clearAuditLogs } from '../src/services/api.js';

test('App.jsx configures auditLogging as opt-in (disabled by default)', () => {
  const appPath = path.resolve('src/App.jsx');
  const content = fs.readFileSync(appPath, 'utf8');

  // Must default auditLogging to false
  assert.ok(content.includes('auditLogging: false'), 'DEFAULT_SETTINGS must have auditLogging: false');
  assert.ok(content.includes('auditLogging: Boolean(stored.auditLogging)'), 'Settings hydration must preserve boolean value');

  // Must call logConversationTurn only when auditLogging is enabled
  assert.ok(content.includes('logConversationTurn'), 'App must import and call logConversationTurn');
  assert.ok(content.includes('settingsRef.current?.auditLogging'), 'App must guard logConversationTurn with auditLogging');
});

test('SettingsModal.jsx provides opt-in audit toggle and audit management controls', () => {
  const settingsModalPath = path.resolve('src/components/SettingsModal.jsx');
  const content = fs.readFileSync(settingsModalPath, 'utf8');

  // Must include audit section and toggle
  assert.ok(content.includes('id="audit-logging-toggle"'), 'Must have #audit-logging-toggle checkbox');
  assert.ok(content.includes('onUpdateSettings({ auditLogging: e.target.checked })'), 'Toggle must update settings');
  assert.ok(content.includes('Auditoría y registro en servidor'), 'Must have clear section heading');
  assert.ok(content.includes('opt-in'), 'Must clearly explain opt-in privacy guarantee');

  // Must include download transcript and clear buttons
  assert.ok(content.includes('id="audit-download-btn"'), 'Must have download audit transcript button');
  assert.ok(content.includes('id="audit-clear-btn"'), 'Must have clear audit records button');
  assert.ok(content.includes('exportAuditTranscript'), 'Must import exportAuditTranscript');
  assert.ok(content.includes('clearAuditLogs'), 'Must import clearAuditLogs');
});

test('api.js exports audit logging and management functions', () => {
  assert.equal(typeof logConversationTurn, 'function', 'logConversationTurn must be exported');
  assert.equal(typeof fetchAuditLogs, 'function', 'fetchAuditLogs must be exported');
  assert.equal(typeof exportAuditTranscript, 'function', 'exportAuditTranscript must be exported');
  assert.equal(typeof clearAuditLogs, 'function', 'clearAuditLogs must be exported');

  const apiPath = path.resolve('src/services/api.js');
  const content = fs.readFileSync(apiPath, 'utf8');
  assert.ok(content.includes('${API_BASE}/audit/log'), 'Must call /api/audit/log');
  assert.ok(content.includes('${API_BASE}/audit/logs'), 'Must call /api/audit/logs');
  assert.ok(content.includes('${API_BASE}/audit/export'), 'Must call /api/audit/export');
});

