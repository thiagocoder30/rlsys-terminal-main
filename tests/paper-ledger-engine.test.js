const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  PaperLedgerEngine
} = require('../dist/domain/ledger/PaperLedgerEngine');

const {
  JsonLinesPaperLedgerRepository
} = require('../dist/infrastructure/ledger/JsonLinesPaperLedgerRepository');

function createStorageDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'rlsys-paper-ledger-'));
}

function buildDecision(overrides = {}) {
  return {
    sourceEventId: 'event-001',
    sessionId: 'session-paper-alpha',
    snapshotId: 'snapshot-alpha-v1',
    timestampMs: 1700000000000,
    decisionType: 'NO_GO',
    theoreticalStake: 0,
    theoreticalPnl: 0,
    expectedEV: 0,
    confidence: 0.82,
    decisionLatencyMs: 14,
    reason: 'RUNTIME_GOVERNANCE_BLOCK',
    ...overrides
  };
}

test('PaperLedgerEngine records NO_GO without changing paper balance', async () => {
  const storageDir = createStorageDir();
  const repository = new JsonLinesPaperLedgerRepository(storageDir);
  const engine = new PaperLedgerEngine(repository, { initialBalance: 1000 });

  await engine.boot();
  const result = await engine.recordDecision(buildDecision());

  assert.equal(result.ok, true);
  assert.equal(result.duplicate, false);
  assert.equal(result.record.runningBalance, 1000);
  assert.equal(result.state.maxDrawdown, 0);

  fs.rmSync(storageDir, { recursive: true, force: true });
});

test('PaperLedgerEngine updates paper PnL and drawdown for theoretical loss', async () => {
  const storageDir = createStorageDir();
  const repository = new JsonLinesPaperLedgerRepository(storageDir);
  const engine = new PaperLedgerEngine(repository, { initialBalance: 1000 });

  await engine.boot();
  const result = await engine.recordDecision(buildDecision({
    sourceEventId: 'event-loss-001',
    decisionType: 'SIGNAL',
    theoreticalStake: 10,
    theoreticalPnl: -10,
    expectedEV: 0.03,
    confidence: 0.91,
    reason: 'PAPER_SIGNAL_LOSS'
  }));

  assert.equal(result.ok, true);
  assert.equal(result.record.runningBalance, 990);
  assert.equal(result.state.drawdown, 10);
  assert.equal(result.state.maxDrawdown, 10);

  fs.rmSync(storageDir, { recursive: true, force: true });
});

test('PaperLedgerEngine restores latest balance from JSONL repository', async () => {
  const storageDir = createStorageDir();
  const repository = new JsonLinesPaperLedgerRepository(storageDir);
  const engine = new PaperLedgerEngine(repository, { initialBalance: 1000 });

  await engine.boot();
  await engine.recordDecision(buildDecision({
    sourceEventId: 'event-win-001',
    decisionType: 'SIGNAL',
    theoreticalStake: 10,
    theoreticalPnl: 25,
    expectedEV: 0.06,
    confidence: 0.93,
    reason: 'PAPER_SIGNAL_WIN'
  }));

  const secondRepository = new JsonLinesPaperLedgerRepository(storageDir);
  const recovered = new PaperLedgerEngine(secondRepository, { initialBalance: 1000 });
  await recovered.boot();

  assert.equal(recovered.getState().runningBalance, 1025);
  assert.equal(recovered.getState().peakBalance, 1025);

  fs.rmSync(storageDir, { recursive: true, force: true });
});

test('PaperLedgerEngine ignores duplicate source event without mutating state twice', async () => {
  const storageDir = createStorageDir();
  const repository = new JsonLinesPaperLedgerRepository(storageDir);
  const engine = new PaperLedgerEngine(repository, { initialBalance: 1000 });

  await engine.boot();
  const input = buildDecision({
    sourceEventId: 'event-duplicate-001',
    decisionType: 'SIGNAL',
    theoreticalStake: 10,
    theoreticalPnl: -10,
    expectedEV: 0.02,
    confidence: 0.88,
    reason: 'DUPLICATE_GUARD'
  });

  const first = await engine.recordDecision(input);
  const second = await engine.recordDecision(input);

  assert.equal(first.ok, true);
  assert.equal(first.duplicate, false);
  assert.equal(second.ok, true);
  assert.equal(second.duplicate, true);
  assert.equal(engine.getState().runningBalance, 990);
  assert.equal(engine.getState().recordedEvents, 1);

  fs.rmSync(storageDir, { recursive: true, force: true });
});

test('PaperLedgerEngine rejects malformed confidence without silent failure', async () => {
  const storageDir = createStorageDir();
  const repository = new JsonLinesPaperLedgerRepository(storageDir);
  const engine = new PaperLedgerEngine(repository, { initialBalance: 1000 });

  await engine.boot();
  const result = await engine.recordDecision(buildDecision({ confidence: 1.5 }));

  assert.equal(result.ok, false);
  assert.equal(result.error, 'INVALID_CONFIDENCE');

  fs.rmSync(storageDir, { recursive: true, force: true });
});
