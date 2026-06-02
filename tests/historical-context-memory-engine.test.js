const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const {
  HistoricalContextMemoryEngine,
} = require('../dist/infrastructure/paper-operational/historical-context-memory-engine');

function policy(overrides = {}) {
  return {
    minimumRecords: 3,
    maxRecords: 50,
    recentWindowMs: 120000,
    maxDrawdownPercentForSupport: 8,
    minimumConsistencyForSupport: 0.65,
    minimumMemoryConfidenceForSupport: 0.6,
    ...overrides,
  };
}

function records() {
  return [
    { sessionId: 'sess-001', tableId: 'mesa-199', strategyId: 'fusion', outcome: 'FAVORAVEL', confidence: 86, netPnL: 10, maxDrawdownPercent: 3, consistencyScore: 0.8, occurredAtEpochMs: 1717200010000 },
    { sessionId: 'sess-002', tableId: 'mesa-199', strategyId: 'fusion', outcome: 'FAVORAVEL', confidence: 84, netPnL: 8, maxDrawdownPercent: 4, consistencyScore: 0.76, occurredAtEpochMs: 1717200011000 },
    { sessionId: 'sess-003', tableId: 'mesa-199', strategyId: 'fusion', outcome: 'OBSERVAR', confidence: 68, netPnL: 0, maxDrawdownPercent: 5, consistencyScore: 0.7, occurredAtEpochMs: 1717200012000 },
    { sessionId: 'sess-004', tableId: 'mesa-199', strategyId: 'fusion', outcome: 'FAVORAVEL', confidence: 88, netPnL: 12, maxDrawdownPercent: 2, consistencyScore: 0.82, occurredAtEpochMs: 1717200013000 },
  ];
}

test('HistoricalContextMemoryEngine returns supportive memory for strong table strategy history', () => {
  const result = new HistoricalContextMemoryEngine().evaluate({
    tableId: 'mesa-199',
    strategyId: 'fusion',
    nowEpochMs: 1717200020000,
    records: records(),
    policy: policy(),
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.decision, 'MEMORY_SUPPORTIVE');
  assert.equal(result.value.suggestedWeight > 1, true);
  assert.equal(result.value.productionMoneyAllowed, false);
  assert.equal(result.value.liveMoneyAuthorization, false);
});

test('HistoricalContextMemoryEngine returns neutral for insufficient matching history', () => {
  const result = new HistoricalContextMemoryEngine().evaluate({
    tableId: 'mesa-199',
    strategyId: 'triplicacao',
    nowEpochMs: 1717200020000,
    records: records(),
    policy: policy(),
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.decision, 'MEMORY_NEUTRAL');
  assert.equal(result.value.suggestedWeight, 1);
});

test('HistoricalContextMemoryEngine returns blocking for bad repeated history', () => {
  const result = new HistoricalContextMemoryEngine().evaluate({
    tableId: 'mesa-ruim-199',
    strategyId: 'fusion',
    nowEpochMs: 1717200020000,
    records: [
      { sessionId: 'sess-001', tableId: 'mesa-ruim-199', strategyId: 'fusion', outcome: 'NAO_UTILIZAR', confidence: 30, netPnL: -10, maxDrawdownPercent: 18, consistencyScore: 0.2, occurredAtEpochMs: 1717200010000 },
      { sessionId: 'sess-002', tableId: 'mesa-ruim-199', strategyId: 'fusion', outcome: 'NAO_UTILIZAR', confidence: 25, netPnL: -12, maxDrawdownPercent: 20, consistencyScore: 0.3, occurredAtEpochMs: 1717200011000 },
      { sessionId: 'sess-003', tableId: 'mesa-ruim-199', strategyId: 'fusion', outcome: 'OBSERVAR', confidence: 50, netPnL: -4, maxDrawdownPercent: 16, consistencyScore: 0.4, occurredAtEpochMs: 1717200012000 },
    ],
    policy: policy(),
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.decision, 'MEMORY_BLOCKING');
  assert.equal(result.value.suggestedWeight, 0.55);
});

test('HistoricalContextMemoryEngine rejects live money flags before structural validation', () => {
  const result = new HistoricalContextMemoryEngine().evaluate({
    tableId: 'mesa-live-199',
    strategyId: 'fusion',
    nowEpochMs: 1717200020000,
    records: [
      { sessionId: 'x', tableId: 'mesa-live-199', strategyId: 'fusion', outcome: 'FAVORAVEL', confidence: 90, netPnL: 10, maxDrawdownPercent: 2, consistencyScore: 0.9, occurredAtEpochMs: 1 },
    ],
    policy: policy(),
    productionMoneyAllowed: true,
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.reason, 'LIVE_MONEY_FORBIDDEN');
  assert.equal(result.error.productionMoneyAllowed, false);
  assert.equal(result.error.liveMoneyAuthorization, false);
});

test('HistoricalContextMemoryEngine rejects malformed record', () => {
  const result = new HistoricalContextMemoryEngine().evaluate({
    tableId: 'mesa-invalid-199',
    strategyId: 'fusion',
    nowEpochMs: 1717200020000,
    records: [
      { sessionId: 'x', tableId: 'mesa-invalid-199', strategyId: 'fusion', outcome: 'FAVORAVEL', confidence: 90, netPnL: 10, maxDrawdownPercent: 2, consistencyScore: 0.9, occurredAtEpochMs: 1 },
    ],
    policy: policy(),
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.reason, 'INVALID_HISTORICAL_CONTEXT_MEMORY_INPUT');
});

test('historical-context-memory-demo emits supportive report', () => {
  const result = spawnSync(process.execPath, ['scripts/historical-context-memory-demo.js'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);

  assert.equal(payload.tableId, 'mesa-demo');
  assert.equal(payload.strategyId, 'fusion');
  assert.equal(payload.decision, 'MEMORY_SUPPORTIVE');
  assert.equal(payload.productionMoneyAllowed, false);
  assert.equal(payload.liveMoneyAuthorization, false);
});
