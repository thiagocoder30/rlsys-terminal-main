'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  PersistentDailyBankrollRiskLock,
} = require('../../../dist/application/runtime/PersistentDailyBankrollRiskLock.js');

const generatedAtEpochMs = 1760000000000;
const unlockAtEpochMs = 1760054400000;

function bankrollRisk(overrides = {}) {
  return {
    integrationId: 'bankroll-risk-273',
    generatedAtEpochMs,
    sessionId: 'session-273',
    strategyName: 'Triplicação',
    readinessVerdict: 'READY_FOR_FIRST_PAPER_SESSION',
    bankrollStatus: 'BANKROLL_BLOCKED',
    canStartPaperSession: false,
    riskProfile: {
      bankroll: 70,
      riskMode: 'CONSERVATIVE',
      baseStake: 0.7,
      dailyStopWin: 5.6,
      dailyStopLoss: 3.5,
      maxSingleExposure: 2.1,
      maxMartingaleSteps: 0,
      recommendedSessionGoal: 'Preservar banca primeiro.',
    },
    bankrollGate: {
      verdict: 'BLOCKED',
      reason: 'Stop loss diário atingido. Encerrar sessão para preservar a banca.',
      allowedStake: 0,
      remainingLossBudget: 0,
      remainingProfitTarget: 5.6,
    },
    currentBalance: 66.5,
    currentSessionPnl: -3.5,
    requestedStake: 0.7,
    stopWinAmount: 5.6,
    stopLossAmount: 3.5,
    remainingLossBudget: 0,
    remainingProfitTarget: 5.6,
    operatorSummary: 'blocked',
    localizedOperatorSummary: 'bloqueado',
    blockers: ['BANKROLL_BLOCKED'],
    warnings: [],
    evidence: [],
    operatorDecisionRequired: true,
    supervisedRecommendationOnly: true,
    institutionalAnalysisMode: true,
    ...overrides,
  };
}

test('persistent daily bankroll risk lock creates stop loss lock', () => {
  const engine = new PersistentDailyBankrollRiskLock();

  const result = engine.create({
    lockId: 'daily-lock-273',
    generatedAtEpochMs,
    operationalDay: '2026-06-08',
    unlockAtEpochMs,
    bankrollRisk: bankrollRisk(),
  });

  assert.equal(result.ok, true);
  assert.notEqual(result.value, null);
  assert.equal(result.value.reason, 'STOP_LOSS_REACHED');
  assert.equal(result.value.isActive, true);
  assert.equal(result.value.currentSessionPnl, -3.5);
  assert.equal(result.value.stopLossAmount, 3.5);
  assert.equal(result.value.operatorDecisionRequired, true);
});

test('persistent daily bankroll risk lock creates stop win lock', () => {
  const engine = new PersistentDailyBankrollRiskLock();

  const result = engine.create({
    lockId: 'daily-lock-273-win',
    generatedAtEpochMs,
    operationalDay: '2026-06-08',
    unlockAtEpochMs,
    bankrollRisk: bankrollRisk({
      currentBalance: 75.6,
      currentSessionPnl: 5.6,
      bankrollGate: {
        verdict: 'BLOCKED',
        reason: 'Stop win diário atingido. Preservar lucro é prioridade.',
        allowedStake: 0,
        remainingLossBudget: 9.1,
        remainingProfitTarget: 0,
      },
    }),
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.reason, 'STOP_WIN_REACHED');
  assert.match(result.value.operatorSummary, /preservar lucro/);
});

test('persistent daily bankroll risk lock does not create lock for ready bankroll', () => {
  const engine = new PersistentDailyBankrollRiskLock();

  const result = engine.create({
    lockId: 'daily-lock-273-none',
    generatedAtEpochMs,
    operationalDay: '2026-06-08',
    unlockAtEpochMs,
    bankrollRisk: bankrollRisk({
      bankrollStatus: 'BANKROLL_READY',
      canStartPaperSession: true,
      bankrollGate: {
        verdict: 'SAFE',
        reason: 'Entrada compatível com a banca e com o perfil de risco.',
        allowedStake: 0.7,
        remainingLossBudget: 3.5,
        remainingProfitTarget: 5.6,
      },
    }),
  });

  assert.equal(result.ok, true);
  assert.equal(result.value, null);
});

test('persistent daily bankroll risk lock evaluates active lock before unlock time', () => {
  const engine = new PersistentDailyBankrollRiskLock();

  const created = engine.create({
    lockId: 'daily-lock-273-active',
    generatedAtEpochMs,
    operationalDay: '2026-06-08',
    unlockAtEpochMs,
    bankrollRisk: bankrollRisk(),
  });

  assert.equal(created.ok, true);

  const evaluation = engine.evaluate({
    evaluatedAtEpochMs: generatedAtEpochMs + 1000,
    lock: created.value,
  });

  assert.equal(evaluation.ok, true);
  assert.equal(evaluation.value.status, 'DAILY_RISK_LOCK_ACTIVE');
  assert.equal(evaluation.value.isBlocked, true);
});

test('persistent daily bankroll risk lock releases after unlock time', () => {
  const engine = new PersistentDailyBankrollRiskLock();

  const created = engine.create({
    lockId: 'daily-lock-273-release',
    generatedAtEpochMs,
    operationalDay: '2026-06-08',
    unlockAtEpochMs,
    bankrollRisk: bankrollRisk(),
  });

  assert.equal(created.ok, true);

  const evaluation = engine.evaluate({
    evaluatedAtEpochMs: unlockAtEpochMs + 1,
    lock: created.value,
  });

  assert.equal(evaluation.ok, true);
  assert.equal(evaluation.value.status, 'DAILY_RISK_LOCK_RELEASED');
  assert.equal(evaluation.value.isBlocked, false);
  assert.equal(evaluation.value.lock.isActive, false);
});

test('persistent daily bankroll risk lock evaluates null lock as not required', () => {
  const engine = new PersistentDailyBankrollRiskLock();

  const evaluation = engine.evaluate({
    evaluatedAtEpochMs: generatedAtEpochMs,
    lock: null,
  });

  assert.equal(evaluation.ok, true);
  assert.equal(evaluation.value.status, 'DAILY_RISK_LOCK_NOT_REQUIRED');
  assert.equal(evaluation.value.isBlocked, false);
});

test('persistent daily bankroll risk lock rejects invalid unlock time', () => {
  const engine = new PersistentDailyBankrollRiskLock();

  const result = engine.create({
    lockId: 'daily-lock-273-invalid',
    generatedAtEpochMs,
    operationalDay: '2026-06-08',
    unlockAtEpochMs: generatedAtEpochMs,
    bankrollRisk: bankrollRisk(),
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'INVALID_DAILY_BANKROLL_RISK_LOCK_INPUT');
});

test('persistent daily bankroll risk lock rejects invalid operational day', () => {
  const engine = new PersistentDailyBankrollRiskLock();

  const result = engine.create({
    lockId: 'daily-lock-273-invalid-day',
    generatedAtEpochMs,
    operationalDay: '08/06/2026',
    unlockAtEpochMs,
    bankrollRisk: bankrollRisk(),
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'INVALID_DAILY_BANKROLL_RISK_LOCK_INPUT');
});

test('persistent daily bankroll risk lock preserves supervised recommendation semantics', () => {
  const engine = new PersistentDailyBankrollRiskLock();

  const result = engine.create({
    lockId: 'daily-lock-273-semantics',
    generatedAtEpochMs,
    operationalDay: '2026-06-08',
    unlockAtEpochMs,
    bankrollRisk: bankrollRisk(),
  });

  assert.equal(result.ok, true);
  assert.equal(Object.prototype.hasOwnProperty.call(result.value, 'automaticExecutionAllowed'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(result.value, 'automaticBetExecutionAllowed'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(result.value, 'liveMoneyAuthorization'), false);
  assert.equal(result.value.operatorDecisionRequired, true);
  assert.equal(result.value.supervisedRecommendationOnly, true);
  assert.equal(result.value.institutionalAnalysisMode, true);
});
