'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DailyRiskLockRecoveryCoordinator,
} = require('../../../dist/application/runtime/DailyRiskLockRecoveryCoordinator.js');

const lockedAtEpochMs = 1760000000000;
const unlockAtEpochMs = 1760054400000;

function lock(overrides = {}) {
  return {
    lockId: 'daily-lock-275',
    sessionId: 'session-275',
    strategyName: 'Triplicação',
    operationalDay: '2026-06-08',
    reason: 'STOP_LOSS_REACHED',
    lockedAtEpochMs,
    unlockAtEpochMs,
    bankroll: 70,
    riskMode: 'CONSERVATIVE',
    currentSessionPnl: -3.5,
    stopWinAmount: 5.6,
    stopLossAmount: 3.5,
    bankrollGateVerdict: 'BLOCKED',
    bankrollGateReason: 'Stop loss diário atingido. Encerrar sessão para preservar a banca.',
    isActive: true,
    operatorSummary: 'Stop Loss atingido. Bloqueio diário criado.',
    operatorDecisionRequired: true,
    supervisedRecommendationOnly: true,
    institutionalAnalysisMode: true,
    ...overrides,
  };
}

class MemoryRepository {
  constructor(initialLock = null, shouldFail = false) {
    this.current = initialLock;
    this.shouldFail = shouldFail;
    this.clearCount = 0;
  }

  async load() {
    if (this.shouldFail) {
      return {
        ok: false,
        error: {
          code: 'IO',
          stage: 'IO',
          message: 'load failed',
        },
      };
    }

    return {
      ok: true,
      value: this.current,
    };
  }

  async clear() {
    if (this.shouldFail) {
      return {
        ok: false,
        error: {
          code: 'IO',
          stage: 'IO',
          message: 'clear failed',
        },
      };
    }

    this.current = null;
    this.clearCount += 1;

    return {
      ok: true,
      value: true,
    };
  }
}

test('daily risk lock recovery coordinator returns no lock when repository is empty', async () => {
  const repository = new MemoryRepository(null);
  const coordinator = new DailyRiskLockRecoveryCoordinator(repository);

  const result = await coordinator.recover({
    recoveredAtEpochMs: lockedAtEpochMs,
    clearReleasedLock: true,
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.status, 'RECOVERY_NO_LOCK');
  assert.equal(result.value.isBlocked, false);
  assert.equal(result.value.lock, null);
  assert.equal(repository.clearCount, 0);
});

test('daily risk lock recovery coordinator keeps active lock after restart', async () => {
  const repository = new MemoryRepository(lock());
  const coordinator = new DailyRiskLockRecoveryCoordinator(repository);

  const result = await coordinator.recover({
    recoveredAtEpochMs: lockedAtEpochMs + 1000,
    clearReleasedLock: true,
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.status, 'RECOVERY_LOCK_ACTIVE');
  assert.equal(result.value.isBlocked, true);
  assert.equal(result.value.lock.lockId, 'daily-lock-275');
  assert.equal(result.value.clearedReleasedLock, false);
  assert.equal(repository.clearCount, 0);
  assert.match(result.value.operatorSummary, /Stop Loss/);
});

test('daily risk lock recovery coordinator releases expired lock and clears repository', async () => {
  const repository = new MemoryRepository(lock());
  const coordinator = new DailyRiskLockRecoveryCoordinator(repository);

  const result = await coordinator.recover({
    recoveredAtEpochMs: unlockAtEpochMs + 1,
    clearReleasedLock: true,
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.status, 'RECOVERY_LOCK_RELEASED');
  assert.equal(result.value.isBlocked, false);
  assert.equal(result.value.clearedReleasedLock, true);
  assert.equal(repository.clearCount, 1);
  assert.equal(repository.current, null);
});

test('daily risk lock recovery coordinator releases expired lock without clearing when configured', async () => {
  const repository = new MemoryRepository(lock());
  const coordinator = new DailyRiskLockRecoveryCoordinator(repository);

  const result = await coordinator.recover({
    recoveredAtEpochMs: unlockAtEpochMs + 1,
    clearReleasedLock: false,
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.status, 'RECOVERY_LOCK_RELEASED');
  assert.equal(result.value.isBlocked, false);
  assert.equal(result.value.clearedReleasedLock, false);
  assert.equal(repository.clearCount, 0);
  assert.notEqual(repository.current, null);
});

test('daily risk lock recovery coordinator maps repository load failure', async () => {
  const repository = new MemoryRepository(null, true);
  const coordinator = new DailyRiskLockRecoveryCoordinator(repository);

  const result = await coordinator.recover({
    recoveredAtEpochMs: unlockAtEpochMs + 1,
    clearReleasedLock: true,
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'DAILY_RISK_LOCK_RECOVERY_FAILED');
  assert.equal(result.error.stage, 'REPOSITORY');
});

test('daily risk lock recovery coordinator rejects invalid recovery time', async () => {
  const repository = new MemoryRepository(null);
  const coordinator = new DailyRiskLockRecoveryCoordinator(repository);

  const result = await coordinator.recover({
    recoveredAtEpochMs: -1,
    clearReleasedLock: true,
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'INVALID_DAILY_RISK_LOCK_RECOVERY_INPUT');
  assert.equal(result.error.stage, 'VALIDATION');
});

test('daily risk lock recovery coordinator preserves supervised recommendation semantics', async () => {
  const repository = new MemoryRepository(lock());
  const coordinator = new DailyRiskLockRecoveryCoordinator(repository);

  const result = await coordinator.recover({
    recoveredAtEpochMs: lockedAtEpochMs + 1000,
    clearReleasedLock: true,
  });

  assert.equal(result.ok, true);
  assert.equal(Object.prototype.hasOwnProperty.call(result.value, 'automaticExecutionAllowed'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(result.value, 'automaticBetExecutionAllowed'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(result.value, 'liveMoneyAuthorization'), false);
  assert.equal(result.value.operatorDecisionRequired, true);
  assert.equal(result.value.supervisedRecommendationOnly, true);
  assert.equal(result.value.institutionalAnalysisMode, true);
});
