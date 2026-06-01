const assert = require('node:assert/strict');
const test = require('node:test');

const {
  PaperSessionRecoveryEngine,
} = require('../dist/domain/bankroll/paper-session-recovery-engine');

function createSnapshot(overrides = {}) {
  return {
    snapshotId: 'snapshot-186',
    sessionId: 'paper-session-186',
    state: 'ACTIVE',
    accountId: 'paper-account-186',
    currentBalance: 100,
    availableBalance: 100,
    realizedPnL: 0,
    journalTotalEvents: 1,
    journalLastSequence: 1,
    updatedAtEpochMs: 1717200000000,
    productionMoneyAllowed: false,
    liveMoneyAuthorization: false,
    version: 1,
    ...overrides,
  };
}

test('PaperSessionRecoveryEngine recovers ACTIVE paper snapshot', () => {
  const result = new PaperSessionRecoveryEngine().recover({
    recoveryId: 'recovery-active-186',
    snapshot: createSnapshot(),
    recoveredAtEpochMs: 1717200000001,
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.reason, 'PAPER_SESSION_RECOVERED');
  assert.equal(result.value.recovery.state, 'RECOVERED_ACTIVE');
  assert.equal(result.value.recovery.productionMoneyAllowed, false);
  assert.equal(result.value.recovery.liveMoneyAuthorization, false);
});

test('PaperSessionRecoveryEngine recovers ENTRY_OPEN paper snapshot', () => {
  const result = new PaperSessionRecoveryEngine().recover({
    recoveryId: 'recovery-entry-186',
    snapshot: createSnapshot({
      state: 'ENTRY_OPEN',
      openTradeId: 'trade-open-186',
      lastTradeId: 'trade-open-186',
    }),
    recoveredAtEpochMs: 1717200000002,
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.recovery.state, 'RECOVERED_ENTRY_OPEN');
  assert.equal(result.value.recovery.openTradeId, 'trade-open-186');
});

test('PaperSessionRecoveryEngine recovers SETTLED paper snapshot', () => {
  const result = new PaperSessionRecoveryEngine().recover({
    recoveryId: 'recovery-settled-186',
    snapshot: createSnapshot({
      state: 'SETTLED',
      lastTradeId: 'trade-settled-186',
      lastSettlementId: 'settlement-186',
      lastOutcome: 'WIN',
      currentBalance: 105,
      availableBalance: 105,
      realizedPnL: 5,
    }),
    recoveredAtEpochMs: 1717200000003,
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.recovery.state, 'RECOVERED_SETTLED');
  assert.equal(result.value.recovery.lastOutcome, 'WIN');
  assert.equal(result.value.recovery.currentBalance, 105);
});

test('PaperSessionRecoveryEngine replays identical recovery idempotently', () => {
  const engine = new PaperSessionRecoveryEngine();
  const input = {
    recoveryId: 'recovery-replay-186',
    snapshot: createSnapshot({ snapshotId: 'snapshot-replay-186' }),
    recoveredAtEpochMs: 1717200000004,
  };

  const first = engine.recover(input);
  assert.equal(first.ok, true);

  const replay = engine.recover({
    ...input,
    previousRecovery: first.value.recovery,
  });

  assert.equal(replay.ok, true);
  assert.equal(replay.value.reason, 'PAPER_SESSION_RECOVERY_REPLAYED_IDEMPOTENTLY');
  assert.deepEqual(replay.value.recovery, first.value.recovery);
});

test('PaperSessionRecoveryEngine rejects recovery id conflict', () => {
  const engine = new PaperSessionRecoveryEngine();

  const first = engine.recover({
    recoveryId: 'recovery-conflict-186',
    snapshot: createSnapshot({ snapshotId: 'snapshot-conflict-a-186' }),
    recoveredAtEpochMs: 1717200000005,
  });

  assert.equal(first.ok, true);

  const conflict = engine.recover({
    recoveryId: 'recovery-conflict-186',
    snapshot: createSnapshot({
      snapshotId: 'snapshot-conflict-b-186',
      currentBalance: 90,
      availableBalance: 90,
    }),
    recoveredAtEpochMs: 1717200000005,
    previousRecovery: first.value.recovery,
  });

  assert.equal(conflict.ok, false);
  assert.equal(conflict.error.reason, 'RECOVERY_ID_CONFLICT');
});

test('PaperSessionRecoveryEngine rejects corrupted live money snapshot', () => {
  const result = new PaperSessionRecoveryEngine().recover({
    recoveryId: 'recovery-live-186',
    snapshot: createSnapshot({
      productionMoneyAllowed: true,
    }),
    recoveredAtEpochMs: 1717200000006,
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.reason, 'CORRUPTED_PAPER_SNAPSHOT_REJECTED');
  assert.equal(result.error.productionMoneyAllowed, false);
  assert.equal(result.error.liveMoneyAuthorization, false);
});

test('PaperSessionRecoveryEngine rejects ENTRY_OPEN snapshot without openTradeId', () => {
  const result = new PaperSessionRecoveryEngine().recover({
    recoveryId: 'recovery-corrupt-entry-186',
    snapshot: createSnapshot({
      state: 'ENTRY_OPEN',
    }),
    recoveredAtEpochMs: 1717200000007,
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.reason, 'CORRUPTED_PAPER_SNAPSHOT_REJECTED');
});

test('PaperSessionRecoveryEngine rejects older recovery timestamp', () => {
  const result = new PaperSessionRecoveryEngine().recover({
    recoveryId: 'recovery-old-186',
    snapshot: createSnapshot({
      updatedAtEpochMs: 1717200000010,
    }),
    recoveredAtEpochMs: 1717200000009,
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.reason, 'RECOVERY_TIMESTAMP_CONFLICT');
});

test('PaperSessionRecoveryEngine rejects malformed input without silent failure', () => {
  const result = new PaperSessionRecoveryEngine().recover({
    recoveryId: 'x',
    snapshot: createSnapshot(),
    recoveredAtEpochMs: 1717200000011,
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.reason, 'INVALID_PAPER_SESSION_RECOVERY_INPUT');
});
