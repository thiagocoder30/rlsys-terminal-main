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
const {
  FirstPaperSessionBankrollRiskIntegration,
} = require('../../../dist/application/runtime/FirstPaperSessionBankrollRiskIntegration.js');

const generatedAtEpochMs = 1760000000000;

function finalVerdict(protocolOverrides = {}) {
  const protocol = new FirstRealPlatformPaperSessionProtocol();
  const checklistExporter = new FirstPaperSessionChecklistExporter();
  const runbookComposer = new FirstPaperSessionRunbookComposer();
  const bundleComposer = new FirstPaperSessionExecutionBundle();
  const packageComposer = new OperatorGuidedSessionPackage();
  const verdict = new FirstPaperSessionFinalReadinessVerdict();

  const protocolResult = protocol.evaluate({
    sessionId: 'bankroll-risk-session-272',
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
    exportId: 'checklist-272',
    generatedAtEpochMs,
    format: 'TEXT',
    protocolReport: protocolResult.value,
  });
  assert.equal(checklistResult.ok, true);

  const runbookResult = runbookComposer.compose({
    runbookId: 'runbook-272',
    generatedAtEpochMs,
    checklistExport: checklistResult.value,
  });
  assert.equal(runbookResult.ok, true);

  const bundleResult = bundleComposer.compose({
    bundleId: 'bundle-272',
    generatedAtEpochMs,
    protocolReport: protocolResult.value,
    checklistExport: checklistResult.value,
    runbook: runbookResult.value,
  });
  assert.equal(bundleResult.ok, true);

  const packageResult = packageComposer.compose({
    packageId: 'package-272',
    generatedAtEpochMs,
    bundle: bundleResult.value,
  });
  assert.equal(packageResult.ok, true);

  const verdictResult = verdict.evaluate({
    verdictId: 'verdict-272',
    generatedAtEpochMs,
    guidedPackage: packageResult.value,
  });
  assert.equal(verdictResult.ok, true);

  return verdictResult.value;
}

test('first paper session bankroll risk integration approves conservative bankroll for ready verdict', () => {
  const integration = new FirstPaperSessionBankrollRiskIntegration();

  const result = integration.evaluate({
    integrationId: 'bankroll-risk-272',
    generatedAtEpochMs,
    finalVerdict: finalVerdict(),
    bankroll: 70,
    riskMode: 'CONSERVATIVE',
    allowMartingale: false,
    currentBalance: 70,
    currentSessionPnl: 0,
    martingaleStep: 0,
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.bankrollStatus, 'BANKROLL_READY');
  assert.equal(result.value.canStartPaperSession, true);
  assert.equal(result.value.riskProfile.baseStake, 0.7);
  assert.equal(result.value.stopWinAmount, 5.6);
  assert.equal(result.value.stopLossAmount, 3.5);
  assert.equal(result.value.requestedStake, 0.7);
  assert.equal(result.value.remainingLossBudget, 3.5);
  assert.equal(result.value.remainingProfitTarget, 5.6);
});

test('first paper session bankroll risk integration blocks when stop loss is reached', () => {
  const integration = new FirstPaperSessionBankrollRiskIntegration();

  const result = integration.evaluate({
    integrationId: 'bankroll-risk-272-stop-loss',
    generatedAtEpochMs,
    finalVerdict: finalVerdict(),
    bankroll: 70,
    riskMode: 'CONSERVATIVE',
    allowMartingale: false,
    currentBalance: 66.5,
    currentSessionPnl: -3.5,
    martingaleStep: 0,
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.bankrollStatus, 'BANKROLL_BLOCKED');
  assert.equal(result.value.canStartPaperSession, false);
  assert.equal(result.value.bankrollGate.verdict, 'BLOCKED');
  assert.match(result.value.bankrollGate.reason, /Stop loss/);
});

test('first paper session bankroll risk integration blocks when stop win is reached', () => {
  const integration = new FirstPaperSessionBankrollRiskIntegration();

  const result = integration.evaluate({
    integrationId: 'bankroll-risk-272-stop-win',
    generatedAtEpochMs,
    finalVerdict: finalVerdict(),
    bankroll: 70,
    riskMode: 'CONSERVATIVE',
    allowMartingale: false,
    currentBalance: 75.6,
    currentSessionPnl: 5.6,
    martingaleStep: 0,
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.bankrollStatus, 'BANKROLL_BLOCKED');
  assert.equal(result.value.canStartPaperSession, false);
  assert.equal(result.value.bankrollGate.verdict, 'BLOCKED');
  assert.match(result.value.bankrollGate.reason, /Stop win/);
});

test('first paper session bankroll risk integration asks review above base stake', () => {
  const integration = new FirstPaperSessionBankrollRiskIntegration();

  const result = integration.evaluate({
    integrationId: 'bankroll-risk-272-review',
    generatedAtEpochMs,
    finalVerdict: finalVerdict(),
    bankroll: 70,
    riskMode: 'CONSERVATIVE',
    allowMartingale: false,
    currentBalance: 70,
    requestedStake: 1.2,
    currentSessionPnl: 0,
    martingaleStep: 0,
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.bankrollStatus, 'BANKROLL_REVIEW_REQUIRED');
  assert.equal(result.value.bankrollGate.verdict, 'REVIEW');
  assert.equal(result.value.canStartPaperSession, true);
  assert.ok(result.value.warnings.some((warning) => warning.includes('BANKROLL_REVIEW')));
});

test('first paper session bankroll risk integration respects readiness verdict block', () => {
  const integration = new FirstPaperSessionBankrollRiskIntegration();

  const result = integration.evaluate({
    integrationId: 'bankroll-risk-272-warmup',
    generatedAtEpochMs,
    finalVerdict: finalVerdict({
      observedRounds: 40,
      favorableCount: 0,
      waitCount: 4,
      noUseCount: 1,
      elevatedRiskCount: 0,
      averageConfidencePercent: 48,
    }),
    bankroll: 70,
    riskMode: 'CONSERVATIVE',
    allowMartingale: false,
    currentBalance: 70,
    currentSessionPnl: 0,
    martingaleStep: 0,
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.readinessVerdict, 'WARMUP_REQUIRED');
  assert.equal(result.value.bankrollStatus, 'BANKROLL_READY');
  assert.equal(result.value.canStartPaperSession, false);
});

test('first paper session bankroll risk integration validates aggressive profile values', () => {
  const integration = new FirstPaperSessionBankrollRiskIntegration();

  const result = integration.evaluate({
    integrationId: 'bankroll-risk-272-aggressive',
    generatedAtEpochMs,
    finalVerdict: finalVerdict(),
    bankroll: 70,
    riskMode: 'AGGRESSIVE',
    allowMartingale: true,
    currentBalance: 70,
    currentSessionPnl: 0,
    martingaleStep: 0,
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.riskProfile.baseStake, 2.1);
  assert.equal(result.value.stopWinAmount, 12.6);
  assert.equal(result.value.stopLossAmount, 8.4);
  assert.equal(result.value.riskProfile.maxMartingaleSteps, 2);
});

test('first paper session bankroll risk integration rejects invalid bankroll', () => {
  const integration = new FirstPaperSessionBankrollRiskIntegration();

  const result = integration.evaluate({
    integrationId: 'bankroll-risk-272-invalid',
    generatedAtEpochMs,
    finalVerdict: finalVerdict(),
    bankroll: 0,
    riskMode: 'CONSERVATIVE',
    allowMartingale: false,
    currentBalance: 70,
    currentSessionPnl: 0,
    martingaleStep: 0,
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'INVALID_FIRST_PAPER_SESSION_BANKROLL_RISK_INPUT');
  assert.equal(result.error.stage, 'VALIDATION');
});

test('first paper session bankroll risk integration does not expose external execution semantics', () => {
  const integration = new FirstPaperSessionBankrollRiskIntegration();

  const result = integration.evaluate({
    integrationId: 'bankroll-risk-272-semantics',
    generatedAtEpochMs,
    finalVerdict: finalVerdict(),
    bankroll: 70,
    riskMode: 'CONSERVATIVE',
    allowMartingale: false,
    currentBalance: 70,
    currentSessionPnl: 0,
    martingaleStep: 0,
  });

  assert.equal(result.ok, true);
  assert.equal(Object.prototype.hasOwnProperty.call(result.value, 'automaticExecutionAllowed'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(result.value, 'automaticBetExecutionAllowed'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(result.value, 'liveMoneyAuthorization'), false);
  assert.equal(result.value.operatorDecisionRequired, true);
  assert.equal(result.value.supervisedRecommendationOnly, true);
  assert.equal(result.value.institutionalAnalysisMode, true);
});
