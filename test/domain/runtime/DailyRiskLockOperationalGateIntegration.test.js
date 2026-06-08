'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DailyRiskLockOperationalGateIntegration,
} = require('../../../dist/application/runtime/DailyRiskLockOperationalGateIntegration.js');

const recoveredAtEpochMs = 1760000001000;
const unlockAtEpochMs = 1760054400000;

function lock(overrides = {}) {
  return {
    lockId: 'daily-lock-276',
    sessionId: 'session-276',
    strategyName: 'Triplicação',
    operationalDay: '2026-06-08',
    reason: 'STOP_LOSS_REACHED',
    lockedAtEpochMs: 1760000000000,
    unlockAtEpochMs,
    bankroll: 70,
    riskMode: 'CONSERVATIVE',
    currentSessionPnl: -3.5,
    stopWinAmount: 5.6,
    stopLossAmount: 3.5,
    bankrollGateVerdict: 'BLOCKED',
    bankrollGateReason: 'Stop loss diário atingido.',
    isActive: true,
    operatorSummary: 'lock ativo',
    operatorDecisionRequired: true,
    supervisedRecommendationOnly: true,
    institutionalAnalysisMode: true,
    ...overrides,
  };
}

function recovery(overrides = {}) {
  return {
    status: 'RECOVERY_LOCK_ACTIVE',
    isBlocked: true,
    recoveredAtEpochMs,
    lock: lock(),
    evaluation: null,
    clearedReleasedLock: false,
    operatorSummary: 'Bloqueio diário ativo.',
    operatorDecisionRequired: true,
    supervisedRecommendationOnly: true,
    institutionalAnalysisMode: true,
    ...overrides,
  };
}

test('daily risk lock operational gate blocks prepare when lock is active', () => {
  const gate = new DailyRiskLockOperationalGateIntegration();

  const result = gate.evaluate({
    intent: 'PREPARE',
    recovery: recovery(),
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.status, 'OPERATION_BLOCKED_BY_DAILY_RISK_LOCK');
  assert.equal(result.value.allowed, false);
  assert.equal(result.value.lockReason, 'STOP_LOSS_REACHED');
  assert.equal(result.value.unlockAtEpochMs, unlockAtEpochMs);
  assert.ok(result.value.reasons.includes('DAILY_RISK_LOCK_ACTIVE'));
});

test('daily risk lock operational gate blocks start when stop win lock is active', () => {
  const gate = new DailyRiskLockOperationalGateIntegration();

  const result = gate.evaluate({
    intent: 'START',
    recovery: recovery({
      lock: lock({
        reason: 'STOP_WIN_REACHED',
      }),
    }),
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.allowed, false);
  assert.equal(result.value.lockReason, 'STOP_WIN_REACHED');
  assert.match(result.value.operatorSummary, /Stop Win/);
});

test('daily risk lock operational gate blocks resume when lock is active', () => {
  const gate = new DailyRiskLockOperationalGateIntegration();

  const result = gate.evaluate({
    intent: 'RESUME',
    recovery: recovery(),
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.allowed, false);
  assert.equal(result.value.status, 'OPERATION_BLOCKED_BY_DAILY_RISK_LOCK');
});

test('daily risk lock operational gate allows informational status while lock is active', () => {
  const gate = new DailyRiskLockOperationalGateIntegration();

  const result = gate.evaluate({
    intent: 'STATUS',
    recovery: recovery(),
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.status, 'OPERATION_ALLOWED');
  assert.equal(result.value.allowed, true);
  assert.equal(result.value.isDailyRiskLocked, true);
  assert.match(result.value.operatorSummary, /apenas informativo/);
});

test('daily risk lock operational gate allows operation when no lock exists', () => {
  const gate = new DailyRiskLockOperationalGateIntegration();

  const result = gate.evaluate({
    intent: 'START',
    recovery: recovery({
      status: 'RECOVERY_NO_LOCK',
      isBlocked: false,
      lock: null,
      operatorSummary: 'Nenhum lock.',
    }),
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.status, 'OPERATION_ALLOWED');
  assert.equal(result.value.allowed, true);
  assert.equal(result.value.lockId, null);
});

test('daily risk lock operational gate allows operation after released lock', () => {
  const gate = new DailyRiskLockOperationalGateIntegration();

  const result = gate.evaluate({
    intent: 'START',
    recovery: recovery({
      status: 'RECOVERY_LOCK_RELEASED',
      isBlocked: false,
      lock: lock({
        isActive: false,
      }),
      operatorSummary: 'Lock liberado.',
    }),
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.status, 'OPERATION_ALLOWED');
  assert.equal(result.value.allowed, true);
  assert.match(result.value.operatorSummary, /liberada/);
});

test('daily risk lock operational gate rejects invalid intent', () => {
  const gate = new DailyRiskLockOperationalGateIntegration();

  const result = gate.evaluate({
    intent: 'BET_NOW',
    recovery: recovery(),
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'INVALID_DAILY_RISK_LOCK_OPERATIONAL_GATE_INPUT');
  assert.equal(result.error.stage, 'VALIDATION');
});

test('daily risk lock operational gate rejects broken recovery semantics', () => {
  const gate = new DailyRiskLockOperationalGateIntegration();

  const result = gate.evaluate({
    intent: 'START',
    recovery: {
      ...recovery(),
      supervisedRecommendationOnly: false,
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'INVALID_DAILY_RISK_LOCK_OPERATIONAL_GATE_INPUT');
});

test('daily risk lock operational gate preserves supervised recommendation semantics', () => {
  const gate = new DailyRiskLockOperationalGateIntegration();

  const result = gate.evaluate({
    intent: 'PREPARE',
    recovery: recovery(),
  });

  assert.equal(result.ok, true);
  assert.equal(Object.prototype.hasOwnProperty.call(result.value, 'automaticExecutionAllowed'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(result.value, 'automaticBetExecutionAllowed'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(result.value, 'liveMoneyAuthorization'), false);
  assert.equal(result.value.operatorDecisionRequired, true);
  assert.equal(result.value.supervisedRecommendationOnly, true);
  assert.equal(result.value.institutionalAnalysisMode, true);
});
