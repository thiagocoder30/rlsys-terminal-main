'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  FirstRealPlatformPaperSessionProtocol,
} = require('../../../dist/application/runtime/FirstRealPlatformPaperSessionProtocol.js');
const {
  FirstPaperSessionChecklistExporter,
} = require('../../../dist/application/runtime/FirstPaperSessionChecklistExporter.js');
const {
  FirstPaperSessionRunbookComposer,
} = require('../../../dist/application/runtime/FirstPaperSessionRunbookComposer.js');

const generatedAtEpochMs = 1760000000000;

function checklistExport(protocolOverrides = {}) {
  const protocol = new FirstRealPlatformPaperSessionProtocol();
  const exporter = new FirstPaperSessionChecklistExporter();

  const protocolResult = protocol.evaluate({
    sessionId: 'first-paper-session-267',
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
    ...protocolOverrides,
  });

  assert.equal(protocolResult.ok, true);

  const exportResult = exporter.export({
    exportId: 'first-paper-checklist-267',
    generatedAtEpochMs,
    format: 'TEXT',
    protocolReport: protocolResult.value,
  });

  assert.equal(exportResult.ok, true);
  return exportResult.value;
}

test('first paper session runbook composer builds ready runbook', () => {
  const composer = new FirstPaperSessionRunbookComposer();

  const result = composer.compose({
    runbookId: 'runbook-267',
    generatedAtEpochMs,
    checklistExport: checklistExport(),
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.runbookId, 'runbook-267');
  assert.equal(result.value.sessionId, 'first-paper-session-267');
  assert.equal(result.value.strategyName, 'Triplicação');
  assert.equal(result.value.protocolStatus, 'READY_FOR_FIRST_PAPER_SESSION');
  assert.equal(result.value.canStartPaperSession, true);
  assert.equal(result.value.steps.length, 8);
  assert.match(result.value.renderedText, /RL\.SYS CORE — FIRST PAPER SESSION RUNBOOK/);
  assert.match(result.value.renderedText, /RUNBOOK STEPS/);
  assert.match(result.value.renderedText, /Exportar relatório final/);
});

test('first paper session runbook composer prioritizes blockers', () => {
  const composer = new FirstPaperSessionRunbookComposer();

  const result = composer.compose({
    runbookId: 'runbook-267-blocked',
    generatedAtEpochMs,
    checklistExport: checklistExport({
      observedRounds: 40,
      favorableCount: 0,
      waitCount: 4,
      noUseCount: 1,
      elevatedRiskCount: 0,
      averageConfidencePercent: 48,
    }),
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.protocolStatus, 'WARMUP_REQUIRED');
  assert.equal(result.value.canStartPaperSession, false);
  assert.equal(result.value.steps[0].title, 'Resolver blockers antes de iniciar');
  assert.ok(result.value.blockers.includes('WARMUP_MINIMO_NAO_CONCLUIDO'));
  assert.match(result.value.renderedText, /WARMUP_MINIMO_NAO_CONCLUIDO/);
});

test('first paper session runbook composer includes warnings as optional review step', () => {
  const composer = new FirstPaperSessionRunbookComposer();

  const result = composer.compose({
    runbookId: 'runbook-267-warning',
    generatedAtEpochMs,
    checklistExport: checklistExport({
      observedRounds: 140,
      favorableCount: 6,
      waitCount: 4,
      noUseCount: 1,
      elevatedRiskCount: 1,
      averageConfidencePercent: 49,
    }),
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.protocolStatus, 'READY_FOR_FIRST_PAPER_SESSION');
  assert.equal(result.value.warnings.length, 2);
  assert.equal(result.value.steps[result.value.steps.length - 1].title, 'Revisar warnings operacionais');
  assert.equal(result.value.steps[result.value.steps.length - 1].mandatory, false);
});

test('first paper session runbook composer rejects invalid runbook id', () => {
  const composer = new FirstPaperSessionRunbookComposer();

  const result = composer.compose({
    runbookId: '',
    generatedAtEpochMs,
    checklistExport: checklistExport(),
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'INVALID_FIRST_PAPER_SESSION_RUNBOOK_INPUT');
  assert.equal(result.error.stage, 'VALIDATION');
});

test('first paper session runbook composer rejects broken checklist governance', () => {
  const composer = new FirstPaperSessionRunbookComposer();
  const checklist = checklistExport();

  const result = composer.compose({
    runbookId: 'runbook-267-broken',
    generatedAtEpochMs,
    checklistExport: {
      ...checklist,
      supervisedRecommendationOnly: false,
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'INVALID_FIRST_PAPER_SESSION_RUNBOOK_INPUT');
});

test('first paper session runbook composer does not expose external execution semantics', () => {
  const composer = new FirstPaperSessionRunbookComposer();

  const result = composer.compose({
    runbookId: 'runbook-267-semantics',
    generatedAtEpochMs,
    checklistExport: checklistExport(),
  });

  assert.equal(result.ok, true);
  assert.equal(Object.prototype.hasOwnProperty.call(result.value, 'automaticExecutionAllowed'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(result.value, 'automaticBetExecutionAllowed'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(result.value, 'liveMoneyAuthorization'), false);
  assert.equal(result.value.operatorDecisionRequired, true);
  assert.equal(result.value.supervisedRecommendationOnly, true);
  assert.equal(result.value.institutionalAnalysisMode, true);
});
