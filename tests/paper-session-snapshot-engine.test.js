const assert = require('node:assert/strict');
const test = require('node:test');

const {
  PaperBankrollAccountEngine,
} = require('../dist/domain/bankroll/paper-bankroll-account-engine');
const {
  PaperSessionJournalEngine,
} = require('../dist/domain/bankroll/paper-session-journal-engine');
const {
  PaperSessionSnapshotEngine,
} = require('../dist/domain/bankroll/paper-session-snapshot-engine');

function createAccount(initialBalance = 100) {
  const result = new PaperBankrollAccountEngine().createAccount({
    accountId: 'paper-snapshot-account',
    initialBalance,
    currency: 'PAPER_BRL',
    createdAtEpochMs: 1717200000000,
  });

  assert.equal(result.ok, true);
  return result.value.account;
}

function createJournal(sessionId = 'paper-session-185') {
  const result = new PaperSessionJournalEngine().append({
    sessionId,
    eventId: 'event-start-185',
    type: 'SESSION_STARTED',
    occurredAtEpochMs: 1717200000001,
    summary: 'Sessão PAPER iniciada.',
    maxEvents: 10,
  });

  assert.equal(result.ok, true);
  return result.value.journal;
}

test('PaperSessionSnapshotEngine creates lightweight PAPER snapshot', () => {
  const result = new PaperSessionSnapshotEngine().compose({
    snapshotId: 'snapshot-185',
    sessionId: 'paper-session-185',
    state: 'ACTIVE',
    account: createAccount(),
    journal: createJournal(),
    updatedAtEpochMs: 1717200000002,
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.reason, 'PAPER_SESSION_SNAPSHOT_CREATED');
  assert.equal(result.value.snapshot.accountId, 'paper-snapshot-account');
  assert.equal(result.value.snapshot.currentBalance, 100);
  assert.equal(result.value.snapshot.availableBalance, 100);
  assert.equal(result.value.snapshot.journalTotalEvents, 1);
  assert.equal(result.value.snapshot.journalLastSequence, 1);
  assert.equal(result.value.snapshot.productionMoneyAllowed, false);
  assert.equal(result.value.snapshot.liveMoneyAuthorization, false);
});

test('PaperSessionSnapshotEngine replays identical snapshot idempotently', () => {
  const engine = new PaperSessionSnapshotEngine();
  const input = {
    snapshotId: 'snapshot-replay-185',
    sessionId: 'paper-session-185-replay',
    state: 'ACTIVE',
    account: createAccount(),
    journal: createJournal('paper-session-185-replay'),
    updatedAtEpochMs: 1717200000003,
  };

  const first = engine.compose(input);
  assert.equal(first.ok, true);

  const replay = engine.compose({
    ...input,
    previousSnapshot: first.value.snapshot,
  });

  assert.equal(replay.ok, true);
  assert.equal(replay.value.reason, 'PAPER_SESSION_SNAPSHOT_REPLAYED_IDEMPOTENTLY');
  assert.deepEqual(replay.value.snapshot, first.value.snapshot);
});

test('PaperSessionSnapshotEngine updates snapshot monotonically', () => {
  const engine = new PaperSessionSnapshotEngine();
  const account = createAccount();
  const journal = createJournal('paper-session-185-update');

  const first = engine.compose({
    snapshotId: 'snapshot-update-a-185',
    sessionId: 'paper-session-185-update',
    state: 'ACTIVE',
    account,
    journal,
    updatedAtEpochMs: 1717200000004,
  });

  assert.equal(first.ok, true);

  const second = engine.compose({
    snapshotId: 'snapshot-update-b-185',
    sessionId: 'paper-session-185-update',
    state: 'FINISHED',
    account,
    journal,
    updatedAtEpochMs: 1717200000005,
    previousSnapshot: first.value.snapshot,
  });

  assert.equal(second.ok, true);
  assert.equal(second.value.reason, 'PAPER_SESSION_SNAPSHOT_UPDATED');
  assert.equal(second.value.snapshot.state, 'FINISHED');
});

test('PaperSessionSnapshotEngine rejects older snapshot update', () => {
  const engine = new PaperSessionSnapshotEngine();
  const account = createAccount();
  const journal = createJournal('paper-session-185-old');

  const first = engine.compose({
    snapshotId: 'snapshot-old-a-185',
    sessionId: 'paper-session-185-old',
    state: 'ACTIVE',
    account,
    journal,
    updatedAtEpochMs: 1717200000006,
  });

  assert.equal(first.ok, true);

  const older = engine.compose({
    snapshotId: 'snapshot-old-b-185',
    sessionId: 'paper-session-185-old',
    state: 'FINISHED',
    account,
    journal,
    updatedAtEpochMs: 1717200000005,
    previousSnapshot: first.value.snapshot,
  });

  assert.equal(older.ok, false);
  assert.equal(older.error.reason, 'SNAPSHOT_VERSION_CONFLICT');
});

test('PaperSessionSnapshotEngine rejects journal session mismatch', () => {
  const result = new PaperSessionSnapshotEngine().compose({
    snapshotId: 'snapshot-mismatch-185',
    sessionId: 'paper-session-185-a',
    state: 'ACTIVE',
    account: createAccount(),
    journal: createJournal('paper-session-185-b'),
    updatedAtEpochMs: 1717200000007,
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.reason, 'SNAPSHOT_SESSION_MISMATCH');
});

test('PaperSessionSnapshotEngine rejects live money flags', () => {
  const result = new PaperSessionSnapshotEngine().compose({
    snapshotId: 'snapshot-live-185',
    sessionId: 'paper-session-185-live',
    state: 'ACTIVE',
    account: createAccount(),
    journal: createJournal('paper-session-185-live'),
    updatedAtEpochMs: 1717200000008,
    productionMoneyAllowed: true,
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.reason, 'LIVE_MONEY_FORBIDDEN');
  assert.equal(result.error.productionMoneyAllowed, false);
  assert.equal(result.error.liveMoneyAuthorization, false);
});

test('PaperSessionSnapshotEngine rejects malformed snapshot input', () => {
  const result = new PaperSessionSnapshotEngine().compose({
    snapshotId: 'x',
    sessionId: 'paper-session-185-invalid',
    state: 'ACTIVE',
    account: createAccount(),
    journal: createJournal('paper-session-185-invalid'),
    updatedAtEpochMs: 1717200000009,
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.reason, 'INVALID_PAPER_SESSION_SNAPSHOT_INPUT');
});
