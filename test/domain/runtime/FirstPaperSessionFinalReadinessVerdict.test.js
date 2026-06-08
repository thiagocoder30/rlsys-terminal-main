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
const {
  FirstPaperSessionFinalReadinessVerdict,
} = require('../../../dist/application/runtime/FirstPaperSessionFinalReadinessVerdict.js');

const generatedAtEpochMs = 1760000000000;

function guidedPackage(protocolOverrides = {}) {
  const protocol = new FirstRealPlatformPaperSessionProtocol();
  const checklistExporter = new FirstPaperSessionChecklistExporter();
  const runbookComposer = new FirstPaperSessionRunbookComposer();
  const bundleComposer = new FirstPaperSessionExecutionBundle();
  const packageComposer = new OperatorGuidedSessionPackage();

  const protocolResult = protocol.evaluate({
    sessionId: 'final-verdict-session-271',
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
    exportId: 'checklist-271',
    generatedAtEpochMs,
    format: 'TEXT',
    protocolReport: protocolResult.value,
  });
  assert.equal(checklistResult.ok, true);

  const runbookResult = runbookComposer.compose({
    runbookId: 'runbook-271',
    generatedAtEpochMs,
    checklistExport: checklistResult.value,
  });
  assert.equal(runbookResult.ok, true);

  const bundleResult = bundleComposer.compose({
    bundleId: 'bundle-271',
    generatedAtEpochMs,
    protocolReport: protocolResult.value,
    checklistExport: checklistResult.value,
    runbook: runbookResult.value,
  });
  assert.equal(bundleResult.ok, true);

  const packageResult = packageComposer.compose({
    packageId: 'package-271',
    generatedAtEpochMs,
    bundle: bundleResult.value,
  });
  assert.equal(packageResult.ok, true);

  return packageResult.value;
}

test('first paper session final readiness verdict approves ready package', () => {
  const verdict = new FirstPaperSessionFinalReadinessVerdict();

  const result = verdict.evaluate({
    verdictId: 'verdict-271',
    generatedAtEpochMs,
    guidedPackage: guidedPackage(),
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.finalVerdict, 'READY_FOR_FIRST_PAPER_SESSION');
  assert.equal(result.value.localizedVerdict.label, 'Pronto para primeira sessão PAPER');
  assert.equal(result.value.canStartPaperSession, true);
  assert.equal(result.value.requiredOperatorAction, 'INICIAR_SESSAO_PAPER_SUPERVISIONADA');
  assert.match(result.value.localizedOperatorSummary, /pronta para início supervisionado/);
});

test('first paper session final readiness verdict maps warmup required', () => {
  const verdict = new FirstPaperSessionFinalReadinessVerdict();

  const result = verdict.evaluate({
    verdictId: 'verdict-271-warmup',
    generatedAtEpochMs,
    guidedPackage: guidedPackage({
      observedRounds: 40,
      favorableCount: 0,
      waitCount: 4,
      noUseCount: 1,
      elevatedRiskCount: 0,
      averageConfidencePercent: 48,
    }),
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.finalVerdict, 'WARMUP_REQUIRED');
  assert.equal(result.value.localizedVerdict.label, 'Warmup obrigatório');
  assert.equal(result.value.canStartPaperSession, false);
  assert.equal(result.value.requiredOperatorAction, 'CONCLUIR_WARMUP_ANTES_DE_INICIAR');
  assert.ok(result.value.blockers.includes('WARMUP_MINIMO_NAO_CONCLUIDO'));
  assert.equal(result.value.localizedBlockers[0].label, 'Warmup mínimo não concluído');
});

test('first paper session final readiness verdict maps blocked package', () => {
  const verdict = new FirstPaperSessionFinalReadinessVerdict();

  const result = verdict.evaluate({
    verdictId: 'verdict-271-blocked',
    generatedAtEpochMs,
    guidedPackage: guidedPackage({
      operatorConfirmedManualMode: false,
    }),
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.finalVerdict, 'BLOCKED');
  assert.equal(result.value.canStartPaperSession, false);
  assert.equal(result.value.requiredOperatorAction, 'RESOLVER_BLOQUEIOS_ANTES_DE_INICIAR');
});

test('first paper session final readiness verdict rejects invalid verdict id', () => {
  const verdict = new FirstPaperSessionFinalReadinessVerdict();

  const result = verdict.evaluate({
    verdictId: '',
    generatedAtEpochMs,
    guidedPackage: guidedPackage(),
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'INVALID_FIRST_PAPER_SESSION_FINAL_VERDICT_INPUT');
  assert.equal(result.error.stage, 'VALIDATION');
});

test('first paper session final readiness verdict rejects unsupported locale', () => {
  const verdict = new FirstPaperSessionFinalReadinessVerdict();

  const result = verdict.evaluate({
    verdictId: 'verdict-271-locale',
    generatedAtEpochMs,
    guidedPackage: guidedPackage(),
    locale: 'en-US',
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'INVALID_FIRST_PAPER_SESSION_FINAL_VERDICT_INPUT');
});

test('first paper session final readiness verdict rejects broken package governance', () => {
  const verdict = new FirstPaperSessionFinalReadinessVerdict();
  const pkg = guidedPackage();

  const result = verdict.evaluate({
    verdictId: 'verdict-271-broken',
    generatedAtEpochMs,
    guidedPackage: {
      ...pkg,
      operatorDecisionRequired: false,
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'INVALID_FIRST_PAPER_SESSION_FINAL_VERDICT_INPUT');
});

test('first paper session final readiness verdict does not expose external execution semantics', () => {
  const verdict = new FirstPaperSessionFinalReadinessVerdict();

  const result = verdict.evaluate({
    verdictId: 'verdict-271-semantics',
    generatedAtEpochMs,
    guidedPackage: guidedPackage(),
  });

  assert.equal(result.ok, true);
  assert.equal(Object.prototype.hasOwnProperty.call(result.value, 'automaticExecutionAllowed'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(result.value, 'automaticBetExecutionAllowed'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(result.value, 'liveMoneyAuthorization'), false);
  assert.equal(result.value.operatorDecisionRequired, true);
  assert.equal(result.value.supervisedRecommendationOnly, true);
  assert.equal(result.value.institutionalAnalysisMode, true);
});
