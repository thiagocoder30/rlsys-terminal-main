const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const {
  PaperPerformanceAnalyzer,
} = require('../dist/infrastructure/paper-operational/paper-performance-analyzer');

function basePolicy(overrides = {}) {
  return {
    minimumTrades: 5,
    maxDrawdownPercent: 10,
    minimumConsistencyScore: 0.5,
    minimumExpectancy: 0,
    minimumRecoveryFactor: 1,
    ...overrides,
  };
}

test('PaperPerformanceAnalyzer returns healthy institutional metrics', () => {
  const result = new PaperPerformanceAnalyzer().analyze({
    sessionId: 'paper-performance-193',
    initialBalance: 100,
    trades: [
      { tradeId: 'trd-001', outcome: 'WIN', stake: 5, pnl: 5, closedAtEpochMs: 1 },
      { tradeId: 'trd-002', outcome: 'LOSS', stake: 5, pnl: -5, closedAtEpochMs: 2 },
      { tradeId: 'trd-003', outcome: 'WIN', stake: 5, pnl: 5, closedAtEpochMs: 3 },
      { tradeId: 'trd-004', outcome: 'PUSH', stake: 5, pnl: 0, closedAtEpochMs: 4 },
      { tradeId: 'trd-005', outcome: 'WIN', stake: 5, pnl: 5, closedAtEpochMs: 5 },
    ],
    policy: basePolicy(),
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.totalTrades, 5);
  assert.equal(result.value.wins, 3);
  assert.equal(result.value.losses, 1);
  assert.equal(result.value.pushes, 1);
  assert.equal(result.value.netPnL, 10);
  assert.equal(result.value.decision, 'PAPER_PERFORMANCE_HEALTHY');
  assert.equal(result.value.certificationImpact, 'CERTIFICATION_SUPPORTIVE');
  assert.equal(result.value.productionMoneyAllowed, false);
  assert.equal(result.value.liveMoneyAuthorization, false);
});

test('PaperPerformanceAnalyzer blocks insufficient sample', () => {
  const result = new PaperPerformanceAnalyzer().analyze({
    sessionId: 'paper-performance-small-193',
    initialBalance: 100,
    trades: [
      { tradeId: 'trd-001', outcome: 'WIN', stake: 5, pnl: 5, closedAtEpochMs: 1 },
    ],
    policy: basePolicy({ minimumTrades: 5 }),
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.decision, 'PAPER_PERFORMANCE_BLOCKED');
  assert.equal(result.value.certificationImpact, 'CERTIFICATION_BLOCKING');
});

test('PaperPerformanceAnalyzer blocks drawdown above policy', () => {
  const result = new PaperPerformanceAnalyzer().analyze({
    sessionId: 'paper-performance-drawdown-193',
    initialBalance: 100,
    trades: [
      { tradeId: 'trd-001', outcome: 'LOSS', stake: 5, pnl: -5, closedAtEpochMs: 1 },
      { tradeId: 'trd-002', outcome: 'LOSS', stake: 5, pnl: -5, closedAtEpochMs: 2 },
      { tradeId: 'trd-003', outcome: 'LOSS', stake: 5, pnl: -5, closedAtEpochMs: 3 },
      { tradeId: 'trd-004', outcome: 'WIN', stake: 5, pnl: 5, closedAtEpochMs: 4 },
      { tradeId: 'trd-005', outcome: 'WIN', stake: 5, pnl: 5, closedAtEpochMs: 5 },
    ],
    policy: basePolicy({ maxDrawdownPercent: 10 }),
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.decision, 'PAPER_PERFORMANCE_BLOCKED');
  assert.equal(result.value.maxDrawdownPercent, 15);
});

test('PaperPerformanceAnalyzer returns observe for weak expectancy', () => {
  const result = new PaperPerformanceAnalyzer().analyze({
    sessionId: 'paper-performance-observe-193',
    initialBalance: 100,
    trades: [
      { tradeId: 'trd-001', outcome: 'WIN', stake: 5, pnl: 3, closedAtEpochMs: 1 },
      { tradeId: 'trd-002', outcome: 'LOSS', stake: 5, pnl: -5, closedAtEpochMs: 2 },
      { tradeId: 'trd-003', outcome: 'WIN', stake: 5, pnl: 3, closedAtEpochMs: 3 },
      { tradeId: 'trd-004', outcome: 'LOSS', stake: 5, pnl: -5, closedAtEpochMs: 4 },
      { tradeId: 'trd-005', outcome: 'PUSH', stake: 5, pnl: 0, closedAtEpochMs: 5 },
    ],
    policy: basePolicy({ maxDrawdownPercent: 20, minimumExpectancy: 0 }),
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.decision, 'PAPER_PERFORMANCE_OBSERVE');
  assert.equal(result.value.certificationImpact, 'CERTIFICATION_NEEDS_REVIEW');
});

test('PaperPerformanceAnalyzer rejects live money flags before structural validation', () => {
  const result = new PaperPerformanceAnalyzer().analyze({
    sessionId: 'paper-performance-live-193',
    initialBalance: 100,
    trades: [
      { tradeId: 'x', outcome: 'WIN', stake: 5, pnl: 5, closedAtEpochMs: 1 },
    ],
    policy: basePolicy({ minimumTrades: 1 }),
    productionMoneyAllowed: true,
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.reason, 'LIVE_MONEY_FORBIDDEN');
  assert.equal(result.error.productionMoneyAllowed, false);
  assert.equal(result.error.liveMoneyAuthorization, false);
});

test('PaperPerformanceAnalyzer rejects malformed paper trade', () => {
  const result = new PaperPerformanceAnalyzer().analyze({
    sessionId: 'paper-performance-invalid-193',
    initialBalance: 100,
    trades: [
      { tradeId: 'trd-001', outcome: 'WIN', stake: 5, pnl: -5, closedAtEpochMs: 1 },
    ],
    policy: basePolicy({ minimumTrades: 1 }),
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.reason, 'INVALID_PAPER_PERFORMANCE_INPUT');
});

test('paper-performance-analyzer-demo emits supportive report', () => {
  const result = spawnSync(process.execPath, ['scripts/paper-performance-analyzer-demo.js'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);

  assert.equal(payload.sessionId, 'paper-performance-demo');
  assert.equal(payload.decision, 'PAPER_PERFORMANCE_HEALTHY');
  assert.equal(payload.certificationImpact, 'CERTIFICATION_SUPPORTIVE');
  assert.equal(payload.productionMoneyAllowed, false);
  assert.equal(payload.liveMoneyAuthorization, false);
});
