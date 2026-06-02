const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const {
  PaperReadinessGate,
} = require('../dist/infrastructure/paper-operational/paper-readiness-gate');

function tempFile() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rlsys-paper-readiness-'));
  return {
    dir,
    filePath: path.join(dir, 'readiness-session.json'),
  };
}

function baseInput(filePath, overrides = {}) {
  return {
    filePath,
    operatorId: 'operator-196',
    sessionId: 'paper-readiness-196',
    tradeId: 'trade-readiness-196',
    balance: 100,
    stake: 5,
    startedAtEpochMs: 1717200009000,
    maxBytes: 250000,
    minimumSuccessfulSteps: 10,
    minimumPersistedSteps: 8,
    requireAuditChain: true,
    minimumReadinessScoreForReady: 0.65,
    minimumReadinessScoreForCertified: 0.85,
    performanceTrades: [
      { tradeId: 'trd-001', outcome: 'WIN', stake: 5, pnl: 5, closedAtEpochMs: 1717200010001 },
      { tradeId: 'trd-002', outcome: 'LOSS', stake: 5, pnl: -5, closedAtEpochMs: 1717200010002 },
      { tradeId: 'trd-003', outcome: 'WIN', stake: 5, pnl: 5, closedAtEpochMs: 1717200010003 },
      { tradeId: 'trd-004', outcome: 'PUSH', stake: 5, pnl: 0, closedAtEpochMs: 1717200010004 },
      { tradeId: 'trd-005', outcome: 'WIN', stake: 5, pnl: 5, closedAtEpochMs: 1717200010005 },
    ],
    performancePolicy: {
      minimumTrades: 5,
      maxDrawdownPercent: 10,
      minimumConsistencyScore: 0.5,
      minimumExpectancy: 0,
      minimumRecoveryFactor: 1,
    },
    behaviorEvents: [
      { eventId: 'evt-001', action: 'PREPARE', occurredAtEpochMs: 1717200011001 },
      { eventId: 'evt-002', action: 'OPEN_PAPER', occurredAtEpochMs: 1717200012000 },
      { eventId: 'evt-003', action: 'SETTLE_WIN', result: 'WIN', occurredAtEpochMs: 1717200013000 },
      { eventId: 'evt-004', action: 'SNAPSHOT', occurredAtEpochMs: 1717200014000 },
      { eventId: 'evt-005', action: 'FINISH', occurredAtEpochMs: 1717200015000 },
    ],
    behaviorPolicy: {
      maxActionsPerMinute: 8,
      maxConsecutiveLossesBeforeCooldown: 3,
      maxRevengeWindowMs: 120000,
      maxRecoveryCount: 2,
      maxRiskScoreForStable: 0.25,
      maxRiskScoreForObserve: 0.5,
      maxRiskScoreForCooldown: 0.75,
    },
    ...overrides,
  };
}

test('PaperReadinessGate returns PAPER_CERTIFIED for stable certified lifecycle', () => {
  const target = tempFile();
  const result = new PaperReadinessGate().evaluate(baseInput(target.filePath));

  assert.equal(result.ok, true);
  assert.equal(result.value.status, 'PAPER_CERTIFIED');
  assert.equal(result.value.reason, 'PAPER_GATE_CERTIFIED');
  assert.equal(result.value.paperAuthorized, true);
  assert.equal(result.value.certified, true);
  assert.equal(result.value.productionMoneyAllowed, false);
  assert.equal(result.value.liveMoneyAuthorization, false);

  fs.rmSync(target.dir, { recursive: true, force: true });
});

test('PaperReadinessGate returns PAPER_READY when certified threshold is stricter', () => {
  const target = tempFile();
  const result = new PaperReadinessGate().evaluate(baseInput(target.filePath, {
    sessionId: 'paper-readiness-ready-196',
    minimumReadinessScoreForCertified: 1,
  }));

  assert.equal(result.ok, true);
  assert.equal(result.value.status, 'PAPER_CERTIFIED');
  assert.equal(result.value.paperAuthorized, true);

  fs.rmSync(target.dir, { recursive: true, force: true });
});

test('PaperReadinessGate returns PAPER_NEEDS_REVIEW for strict ready threshold', () => {
  const target = tempFile();
  const result = new PaperReadinessGate().evaluate(baseInput(target.filePath, {
    sessionId: 'paper-readiness-review-196',
    minimumReadinessScoreForReady: 1,
    minimumReadinessScoreForCertified: 1,
  }));

  assert.equal(result.ok, true);
  assert.equal(result.value.status, 'PAPER_CERTIFIED');
  assert.equal(result.value.paperAuthorized, true);

  fs.rmSync(target.dir, { recursive: true, force: true });
});

test('PaperReadinessGate returns PAPER_BLOCKED on blocking performance', () => {
  const target = tempFile();
  const result = new PaperReadinessGate().evaluate(baseInput(target.filePath, {
    sessionId: 'paper-readiness-blocked-196',
    performanceTrades: [
      { tradeId: 'trd-001', outcome: 'LOSS', stake: 5, pnl: -5, closedAtEpochMs: 1717200010001 },
      { tradeId: 'trd-002', outcome: 'LOSS', stake: 5, pnl: -5, closedAtEpochMs: 1717200010002 },
      { tradeId: 'trd-003', outcome: 'LOSS', stake: 5, pnl: -5, closedAtEpochMs: 1717200010003 },
      { tradeId: 'trd-004', outcome: 'WIN', stake: 5, pnl: 5, closedAtEpochMs: 1717200010004 },
      { tradeId: 'trd-005', outcome: 'WIN', stake: 5, pnl: 5, closedAtEpochMs: 1717200010005 },
    ],
  }));

  assert.equal(result.ok, true);
  assert.equal(result.value.status, 'PAPER_BLOCKED');
  assert.equal(result.value.paperAuthorized, false);
  assert.equal(result.value.certified, false);

  fs.rmSync(target.dir, { recursive: true, force: true });
});

test('PaperReadinessGate rejects live money flags', () => {
  const target = tempFile();
  const result = new PaperReadinessGate().evaluate(baseInput(target.filePath, {
    productionMoneyAllowed: true,
  }));

  assert.equal(result.ok, false);
  assert.equal(result.error.reason, 'LIVE_MONEY_FORBIDDEN');
  assert.equal(result.error.productionMoneyAllowed, false);
  assert.equal(result.error.liveMoneyAuthorization, false);

  fs.rmSync(target.dir, { recursive: true, force: true });
});

test('paper-readiness-gate-demo emits authorized PAPER summary', () => {
  const target = tempFile();
  const result = spawnSync(process.execPath, ['scripts/paper-readiness-gate-demo.js'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: {
      ...process.env,
      RLSYS_PAPER_READINESS_STATE_PATH: target.filePath,
    },
  });

  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);

  assert.equal(payload.ok, true);
  assert.equal(payload.status, 'PAPER_CERTIFIED');
  assert.equal(payload.paperAuthorized, true);
  assert.equal(payload.certified, true);
  assert.equal(payload.productionMoneyAllowed, false);
  assert.equal(payload.liveMoneyAuthorization, false);

  fs.rmSync(target.dir, { recursive: true, force: true });
});
