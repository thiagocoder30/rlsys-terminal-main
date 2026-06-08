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
const {
  FirstPaperSessionExecutionBundle,
} = require('../../../dist/application/runtime/FirstPaperSessionExecutionBundle.js');

const generatedAtEpochMs = 1760000000000;

function artifacts(protocolOverrides = {}) {
  const protocol = new FirstRealPlatformPaperSessionProtocol();
  const checklistExporter = new FirstPaperSessionChecklistExporter();
  const runbookComposer = new FirstPaperSessionRunbookComposer();

  const protocolResult = protocol.evaluate({
    sessionId: 'first-paper-session-268',
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

  const checklistResult = checklistExporter.export({
    exportId: 'first-paper-checklist-268',
    generatedAtEpochMs,
    format: 'TEXT',
    protocolReport: protocolResult.value,
  });

  assert.equal(checklistResult.ok, true);

  const runbookResult = runbookComposer.compose({
    runbookId: 'runbook-268',
    generatedAtEpochMs,
    checklistExport: checklistResult.value,
  });

  assert.equal(runbookResult.ok, true);

  return {
    protocolReport: protocolResult.value,
    checklistExport: checklistResult.value,
    runbook: runbookResult.value,
  };
}

test('first paper session execution bundle composes ready bundle', () => {
  const bundle = new FirstPaperSessionExecutionBundle();
  const source = artifacts();

  const result = bundle.compose({
    bundleId: 'bundle-268',
    generatedAtEpochMs,
    ...source,
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.bundleId, 'bundle-268');
  assert.equal(result.value.sessionId, 'first-paper-session-268');
  assert.equal(result.value.strategyName, 'Triplicação');
  assert.equal(result.value.status, 'BUNDLE_READY');
  assert.equal(result.value.canStartPaperSession, true);
  assert.equal(result.value.protocolStatus, 'READY_FOR_FIRST_PAPER_SESSION');
  assert.equal(result.value.checklistExportId, 'first-paper-checklist-268');
  assert.equal(result.value.runbookId, 'runbook-268');
  assert.equal(result.value.blockers.length, 0);
  assert.ok(result.value.operatorReadinessChecklist.length > 0);
});

test('first paper session execution bundle maps warmup required status', () => {
  const bundle = new FirstPaperSessionExecutionBundle();
  const source = artifacts({
    observedRounds: 40,
    favorableCount: 0,
    waitCount: 4,
    noUseCount: 1,
    elevatedRiskCount: 0,
    averageConfidencePercent: 48,
  });

  const result = bundle.compose({
    bundleId: 'bundle-268-warmup',
    generatedAtEpochMs,
    ...source,
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.status, 'BUNDLE_WARMUP_REQUIRED');
  assert.equal(result.value.canStartPaperSession, false);
  assert.ok(result.value.blockers.includes('WARMUP_MINIMO_NAO_CONCLUIDO'));
});

test('first paper session execution bundle rejects mismatched session artifacts', () => {
  const bundle = new FirstPaperSessionExecutionBundle();
  const source = artifacts();

  const result = bundle.compose({
    bundleId: 'bundle-268-mismatch',
    generatedAtEpochMs,
    protocolReport: {
      ...source.protocolReport,
      sessionId: 'another-session',
    },
    checklistExport: source.checklistExport,
    runbook: source.runbook,
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'INVALID_FIRST_PAPER_SESSION_EXECUTION_BUNDLE_INPUT');
  assert.match(result.error.message, /same session/);
});

test('first paper session execution bundle rejects mismatched strategy artifacts', () => {
  const bundle = new FirstPaperSessionExecutionBundle();
  const source = artifacts();

  const result = bundle.compose({
    bundleId: 'bundle-268-strategy-mismatch',
    generatedAtEpochMs,
    protocolReport: {
      ...source.protocolReport,
      strategyName: 'Outra Estratégia',
    },
    checklistExport: source.checklistExport,
    runbook: source.runbook,
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'INVALID_FIRST_PAPER_SESSION_EXECUTION_BUNDLE_INPUT');
  assert.match(result.error.message, /same strategy/);
});

test('first paper session execution bundle rejects invalid bundle id', () => {
  const bundle = new FirstPaperSessionExecutionBundle();
  const source = artifacts();

  const result = bundle.compose({
    bundleId: '',
    generatedAtEpochMs,
    ...source,
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'INVALID_FIRST_PAPER_SESSION_EXECUTION_BUNDLE_INPUT');
});

test('first paper session execution bundle rejects broken governance semantics', () => {
  const bundle = new FirstPaperSessionExecutionBundle();
  const source = artifacts();

  const result = bundle.compose({
    bundleId: 'bundle-268-broken',
    generatedAtEpochMs,
    protocolReport: {
      ...source.protocolReport,
      operatorDecisionRequired: false,
    },
    checklistExport: source.checklistExport,
    runbook: source.runbook,
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'INVALID_FIRST_PAPER_SESSION_EXECUTION_BUNDLE_INPUT');
});

test('first paper session execution bundle does not expose external execution semantics', () => {
  const bundle = new FirstPaperSessionExecutionBundle();
  const source = artifacts();

  const result = bundle.compose({
    bundleId: 'bundle-268-semantics',
    generatedAtEpochMs,
    ...source,
  });

  assert.equal(result.ok, true);
  assert.equal(Object.prototype.hasOwnProperty.call(result.value, 'automaticExecutionAllowed'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(result.value, 'automaticBetExecutionAllowed'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(result.value, 'liveMoneyAuthorization'), false);
  assert.equal(result.value.operatorDecisionRequired, true);
  assert.equal(result.value.supervisedRecommendationOnly, true);
  assert.equal(result.value.institutionalAnalysisMode, true);
});
