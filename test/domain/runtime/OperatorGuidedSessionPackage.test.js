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
const {
  OperatorGuidedSessionPackage,
} = require('../../../dist/application/runtime/OperatorGuidedSessionPackage.js');

const generatedAtEpochMs = 1760000000000;

function bundle(protocolOverrides = {}) {
  const protocol = new FirstRealPlatformPaperSessionProtocol();
  const checklistExporter = new FirstPaperSessionChecklistExporter();
  const runbookComposer = new FirstPaperSessionRunbookComposer();
  const bundleComposer = new FirstPaperSessionExecutionBundle();

  const protocolResult = protocol.evaluate({
    sessionId: 'guided-session-269',
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
    exportId: 'checklist-269',
    generatedAtEpochMs,
    format: 'TEXT',
    protocolReport: protocolResult.value,
  });
  assert.equal(checklistResult.ok, true);

  const runbookResult = runbookComposer.compose({
    runbookId: 'runbook-269',
    generatedAtEpochMs,
    checklistExport: checklistResult.value,
  });
  assert.equal(runbookResult.ok, true);

  const bundleResult = bundleComposer.compose({
    bundleId: 'bundle-269',
    generatedAtEpochMs,
    protocolReport: protocolResult.value,
    checklistExport: checklistResult.value,
    runbook: runbookResult.value,
  });
  assert.equal(bundleResult.ok, true);

  return bundleResult.value;
}

test('operator guided session package composes ready package', () => {
  const composer = new OperatorGuidedSessionPackage();

  const result = composer.compose({
    packageId: 'package-269',
    generatedAtEpochMs,
    bundle: bundle(),
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.packageId, 'package-269');
  assert.equal(result.value.bundleId, 'bundle-269');
  assert.equal(result.value.sessionId, 'guided-session-269');
  assert.equal(result.value.strategyName, 'Triplicação');
  assert.equal(result.value.status, 'GUIDED_PACKAGE_READY');
  assert.equal(result.value.canStartPaperSession, true);
  assert.ok(result.value.instructions.length >= 8);
  assert.match(result.value.renderedText, /RL\.SYS CORE — OPERATOR GUIDED SESSION PACKAGE/);
  assert.match(result.value.renderedText, /GUIDED INSTRUCTIONS/);
  assert.match(result.value.renderedText, /Registrar cada giro observado/);
});

test('operator guided session package maps warmup required', () => {
  const composer = new OperatorGuidedSessionPackage();

  const result = composer.compose({
    packageId: 'package-269-warmup',
    generatedAtEpochMs,
    bundle: bundle({
      observedRounds: 40,
      favorableCount: 0,
      waitCount: 4,
      noUseCount: 1,
      elevatedRiskCount: 0,
      averageConfidencePercent: 48,
    }),
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.status, 'GUIDED_PACKAGE_WARMUP_REQUIRED');
  assert.equal(result.value.canStartPaperSession, false);
  assert.ok(result.value.blockers.includes('WARMUP_MINIMO_NAO_CONCLUIDO'));
});

test('operator guided session package maps blocked bundle', () => {
  const composer = new OperatorGuidedSessionPackage();

  const result = composer.compose({
    packageId: 'package-269-blocked',
    generatedAtEpochMs,
    bundle: bundle({
      operatorConfirmedManualMode: false,
    }),
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.status, 'GUIDED_PACKAGE_BLOCKED');
  assert.equal(result.value.canStartPaperSession, false);
  assert.ok(result.value.instructions[0].title.includes('Resolver blockers'));
});

test('operator guided session package rejects invalid package id', () => {
  const composer = new OperatorGuidedSessionPackage();

  const result = composer.compose({
    packageId: '',
    generatedAtEpochMs,
    bundle: bundle(),
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'INVALID_OPERATOR_GUIDED_SESSION_PACKAGE_INPUT');
  assert.equal(result.error.stage, 'VALIDATION');
});

test('operator guided session package rejects broken governance semantics', () => {
  const composer = new OperatorGuidedSessionPackage();
  const source = bundle();

  const result = composer.compose({
    packageId: 'package-269-broken',
    generatedAtEpochMs,
    bundle: {
      ...source,
      supervisedRecommendationOnly: false,
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'INVALID_OPERATOR_GUIDED_SESSION_PACKAGE_INPUT');
});

test('operator guided session package does not expose external execution semantics', () => {
  const composer = new OperatorGuidedSessionPackage();

  const result = composer.compose({
    packageId: 'package-269-semantics',
    generatedAtEpochMs,
    bundle: bundle(),
  });

  assert.equal(result.ok, true);
  assert.equal(Object.prototype.hasOwnProperty.call(result.value, 'automaticExecutionAllowed'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(result.value, 'automaticBetExecutionAllowed'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(result.value, 'liveMoneyAuthorization'), false);
  assert.equal(result.value.operatorDecisionRequired, true);
  assert.equal(result.value.supervisedRecommendationOnly, true);
  assert.equal(result.value.institutionalAnalysisMode, true);
});
