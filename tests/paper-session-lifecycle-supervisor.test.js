const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const {
  PaperSessionLifecycleSupervisor,
} = require('../dist/infrastructure/paper-operational/paper-session-lifecycle-supervisor');

function tempFile() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rlsys-paper-lifecycle-'));
  return {
    dir,
    filePath: path.join(dir, 'lifecycle-session.json'),
  };
}

function baseInput(filePath, overrides = {}) {
  return {
    filePath,
    operatorId: 'operator-195',
    sessionId: 'paper-lifecycle-195',
    tradeId: 'trade-lifecycle-195',
    balance: 100,
    stake: 5,
    startedAtEpochMs: 1717200006000,
    maxBytes: 250000,
    minimumSuccessfulSteps: 10,
    minimumPersistedSteps: 8,
    requireAuditChain: true,
    performanceTrades: [
      { tradeId: 'trd-001', outcome: 'WIN', stake: 5, pnl: 5, closedAtEpochMs: 1717200007001 },
      { tradeId: 'trd-002', outcome: 'LOSS', stake: 5, pnl: -5, closedAtEpochMs: 1717200007002 },
      { tradeId: 'trd-003', outcome: 'WIN', stake: 5, pnl: 5, closedAtEpochMs: 1717200007003 },
      { tradeId: 'trd-004', outcome: 'PUSH', stake: 5, pnl: 0, closedAtEpochMs: 1717200007004 },
      { tradeId: 'trd-005', outcome: 'WIN', stake: 5, pnl: 5, closedAtEpochMs: 1717200007005 },
    ],
    performancePolicy: {
      minimumTrades: 5,
      maxDrawdownPercent: 10,
      minimumConsistencyScore: 0.5,
      minimumExpectancy: 0,
      minimumRecoveryFactor: 1,
    },
    behaviorEvents: [
      { eventId: 'evt-001', action: 'PREPARE', occurredAtEpochMs: 1717200008001 },
      { eventId: 'evt-002', action: 'OPEN_PAPER', occurredAtEpochMs: 1717200009000 },
      { eventId: 'evt-003', action: 'SETTLE_WIN', result: 'WIN', occurredAtEpochMs: 1717200010000 },
      { eventId: 'evt-004', action: 'SNAPSHOT', occurredAtEpochMs: 1717200011000 },
      { eventId: 'evt-005', action: 'FINISH', occurredAtEpochMs: 1717200012000 },
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

test('PaperSessionLifecycleSupervisor certifies stable lifecycle', () => {
  const target = tempFile();
  const result = new PaperSessionLifecycleSupervisor().supervise(baseInput(target.filePath));

  assert.equal(result.ok, true);
  assert.equal(result.value.decision, 'PAPER_SESSION_CERTIFIED');
  assert.equal(result.value.reason, 'PAPER_SESSION_LIFECYCLE_CERTIFIED');
  assert.equal(result.value.certificationStatus, 'PAPER_CERTIFIED');
  assert.equal(result.value.performanceDecision, 'PAPER_PERFORMANCE_HEALTHY');
  assert.equal(result.value.behaviorReadiness, 'OPERATOR_STABLE');
  assert.equal(result.value.productionMoneyAllowed, false);
  assert.equal(result.value.liveMoneyAuthorization, false);

  fs.rmSync(target.dir, { recursive: true, force: true });
});

test('PaperSessionLifecycleSupervisor blocks poor performance', () => {
  const target = tempFile();
  const result = new PaperSessionLifecycleSupervisor().supervise(baseInput(target.filePath, {
    sessionId: 'paper-lifecycle-blocked-195',
    performanceTrades: [
      { tradeId: 'trd-001', outcome: 'LOSS', stake: 5, pnl: -5, closedAtEpochMs: 1717200007001 },
      { tradeId: 'trd-002', outcome: 'LOSS', stake: 5, pnl: -5, closedAtEpochMs: 1717200007002 },
      { tradeId: 'trd-003', outcome: 'LOSS', stake: 5, pnl: -5, closedAtEpochMs: 1717200007003 },
      { tradeId: 'trd-004', outcome: 'WIN', stake: 5, pnl: 5, closedAtEpochMs: 1717200007004 },
      { tradeId: 'trd-005', outcome: 'WIN', stake: 5, pnl: 5, closedAtEpochMs: 1717200007005 },
    ],
  }));

  assert.equal(result.ok, true);
  assert.equal(result.value.decision, 'PAPER_SESSION_BLOCKED');
  assert.equal(result.value.performance.certificationImpact, 'CERTIFICATION_BLOCKING');

  fs.rmSync(target.dir, { recursive: true, force: true });
});

test('PaperSessionLifecycleSupervisor needs review on operator cooldown', () => {
  const target = tempFile();
  const result = new PaperSessionLifecycleSupervisor().supervise(baseInput(target.filePath, {
    sessionId: 'paper-lifecycle-review-195',
    behaviorEvents: [
      { eventId: 'evt-001', action: 'OPEN_PAPER', occurredAtEpochMs: 1717200008001 },
      { eventId: 'evt-002', action: 'SETTLE_LOSS', result: 'LOSS', occurredAtEpochMs: 1717200009000 },
      { eventId: 'evt-003', action: 'OPEN_PAPER', occurredAtEpochMs: 1717200010000 },
      { eventId: 'evt-004', action: 'SETTLE_LOSS', result: 'LOSS', occurredAtEpochMs: 1717200011000 },
      { eventId: 'evt-005', action: 'OPEN_PAPER', occurredAtEpochMs: 1717200012000 },
    ],
    behaviorPolicy: {
      maxActionsPerMinute: 8,
      maxConsecutiveLossesBeforeCooldown: 4,
      maxRevengeWindowMs: 120000,
      maxRecoveryCount: 4,
      maxRiskScoreForStable: 0.1,
      maxRiskScoreForObserve: 0.2,
      maxRiskScoreForCooldown: 0.9,
    },
  }));

  assert.equal(result.ok, true);
  assert.equal(result.value.decision, 'PAPER_SESSION_NEEDS_REVIEW');

  fs.rmSync(target.dir, { recursive: true, force: true });
});

test('PaperSessionLifecycleSupervisor rejects live money flags', () => {
  const target = tempFile();
  const result = new PaperSessionLifecycleSupervisor().supervise(baseInput(target.filePath, {
    productionMoneyAllowed: true,
  }));

  assert.equal(result.ok, false);
  assert.equal(result.error.reason, 'LIVE_MONEY_FORBIDDEN');
  assert.equal(result.error.productionMoneyAllowed, false);
  assert.equal(result.error.liveMoneyAuthorization, false);

  fs.rmSync(target.dir, { recursive: true, force: true });
});

test('paper-session-lifecycle-supervisor-demo emits certified summary', () => {
  const target = tempFile();
  const result = spawnSync(process.execPath, ['scripts/paper-session-lifecycle-supervisor-demo.js'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: {
      ...process.env,
      RLSYS_PAPER_LIFECYCLE_STATE_PATH: target.filePath,
    },
  });

  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);

  assert.equal(payload.ok, true);
  assert.equal(payload.decision, 'PAPER_SESSION_CERTIFIED');
  assert.equal(payload.certificationStatus, 'PAPER_CERTIFIED');
  assert.equal(payload.performanceDecision, 'PAPER_PERFORMANCE_HEALTHY');
  assert.equal(payload.behaviorReadiness, 'OPERATOR_STABLE');
  assert.equal(payload.productionMoneyAllowed, false);
  assert.equal(payload.liveMoneyAuthorization, false);

  fs.rmSync(target.dir, { recursive: true, force: true });
});
