'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  FirstRealPlatformPaperSessionProtocol,
} = require('../../../dist/application/runtime/FirstRealPlatformPaperSessionProtocol.js');
const {
  FirstPaperSessionChecklistExporter,
} = require('../../../dist/application/runtime/FirstPaperSessionChecklistExporter.js');

const generatedAtEpochMs = 1760000000000;

function protocolReport(overrides = {}) {
  const protocol = new FirstRealPlatformPaperSessionProtocol();
  const result = protocol.evaluate({
    sessionId: 'first-paper-session-266',
    strategyName: 'Triplicação',
    observedRounds: 120,
    favorableCount: 2,
    waitCount: 8,
    noUseCount: 1,
    elevatedRiskCount: 1,
    averageConfidencePercent: 68,
    operatorConfirmedManualMode: true,
    operatorConfirmedNoExternalIntegration: true,
    operatorConfirmedPaperTracking: true,
    ...overrides,
  });

  assert.equal(result.ok, true);
  return result.value;
}

test('first paper session checklist exporter exports TEXT checklist', () => {
  const exporter = new FirstPaperSessionChecklistExporter();

  const result = exporter.export({
    exportId: 'first-paper-checklist-266',
    generatedAtEpochMs,
    format: 'TEXT',
    protocolReport: protocolReport(),
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.exportId, 'first-paper-checklist-266');
  assert.equal(result.value.format, 'TEXT');
  assert.equal(result.value.sessionId, 'first-paper-session-266');
  assert.equal(result.value.strategyName, 'Triplicação');
  assert.equal(result.value.status, 'READY_FOR_FIRST_PAPER_SESSION');
  assert.match(result.value.text, /RL\.SYS CORE — FIRST PAPER SESSION CHECKLIST/);
  assert.match(result.value.text, /Strategy: Triplicação/);
  assert.match(result.value.text, /CHECKLIST/);
  assert.match(result.value.text, /GOVERNANCE/);
  assert.equal(result.value.json.checklist.length > 0, true);
});

test('first paper session checklist exporter exports JSON text', () => {
  const exporter = new FirstPaperSessionChecklistExporter();

  const result = exporter.export({
    exportId: 'first-paper-checklist-266-json',
    generatedAtEpochMs,
    format: 'JSON',
    protocolReport: protocolReport(),
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.format, 'JSON');

  const parsed = JSON.parse(result.value.text);
  assert.equal(parsed.exportId, 'first-paper-checklist-266-json');
  assert.equal(parsed.strategyName, 'Triplicação');
  assert.equal(parsed.governance.operatorDecisionRequired, true);
  assert.equal(parsed.governance.supervisedRecommendationOnly, true);
});

test('first paper session checklist exporter includes blockers and warnings', () => {
  const exporter = new FirstPaperSessionChecklistExporter();

  const result = exporter.export({
    exportId: 'first-paper-checklist-266-blocked',
    generatedAtEpochMs,
    format: 'TEXT',
    protocolReport: protocolReport({
      observedRounds: 40,
      favorableCount: 0,
      waitCount: 4,
      noUseCount: 1,
      elevatedRiskCount: 0,
      averageConfidencePercent: 48,
    }),
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.status, 'WARMUP_REQUIRED');
  assert.match(result.value.text, /WARMUP_MINIMO_NAO_CONCLUIDO/);
  assert.match(result.value.text, /CONFIANCA_MEDIA_ABAIXO_DO_MINIMO_RECOMENDADO/);
});

test('first paper session checklist exporter rejects invalid export id', () => {
  const exporter = new FirstPaperSessionChecklistExporter();

  const result = exporter.export({
    exportId: '',
    generatedAtEpochMs,
    format: 'TEXT',
    protocolReport: protocolReport(),
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'INVALID_FIRST_PAPER_SESSION_CHECKLIST_EXPORT_INPUT');
  assert.equal(result.error.stage, 'VALIDATION');
});

test('first paper session checklist exporter rejects invalid format', () => {
  const exporter = new FirstPaperSessionChecklistExporter();

  const result = exporter.export({
    exportId: 'first-paper-checklist-266-invalid',
    generatedAtEpochMs,
    format: 'PDF',
    protocolReport: protocolReport(),
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'INVALID_FIRST_PAPER_SESSION_CHECKLIST_EXPORT_INPUT');
});

test('first paper session checklist exporter rejects broken governance semantics', () => {
  const exporter = new FirstPaperSessionChecklistExporter();
  const report = protocolReport();

  const result = exporter.export({
    exportId: 'first-paper-checklist-266-broken',
    generatedAtEpochMs,
    format: 'TEXT',
    protocolReport: {
      ...report,
      operatorDecisionRequired: false,
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'INVALID_FIRST_PAPER_SESSION_CHECKLIST_EXPORT_INPUT');
});

test('first paper session checklist exporter does not expose external execution semantics', () => {
  const exporter = new FirstPaperSessionChecklistExporter();

  const result = exporter.export({
    exportId: 'first-paper-checklist-266-semantics',
    generatedAtEpochMs,
    format: 'TEXT',
    protocolReport: protocolReport(),
  });

  assert.equal(result.ok, true);
  assert.equal(Object.prototype.hasOwnProperty.call(result.value, 'automaticExecutionAllowed'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(result.value, 'automaticBetExecutionAllowed'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(result.value, 'liveMoneyAuthorization'), false);
  assert.equal(result.value.operatorDecisionRequired, true);
  assert.equal(result.value.supervisedRecommendationOnly, true);
  assert.equal(result.value.institutionalAnalysisMode, true);
});
