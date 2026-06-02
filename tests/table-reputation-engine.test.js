const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const {
  TableReputationEngine,
} = require('../dist/infrastructure/paper-operational/table-reputation-engine');

function policy(overrides = {}) {
  return {
    minimumRecords: 3,
    maxRecords: 100,
    recentWindowMs: 120000,
    maxVolatilityForStable: 0.4,
    maxDrawdownPercentForStable: 8,
    blockingDrawdownPercent: 15,
    minimumConsensusSupport: 0.7,
    ...overrides,
  };
}

function strongRecords() {
  return [
    { sessionId: 'sess-001', tableId: 'mesa-201', outcome: 'PAPER_FAVORAVEL', confidence: 86, consensusScore: 0.86, volatilityScore: 0.2, maxDrawdownPercent: 3, strategyDiversity: 0.7, operatorStable: true, occurredAtEpochMs: 1717200010000 },
    { sessionId: 'sess-002', tableId: 'mesa-201', outcome: 'PAPER_FAVORAVEL', confidence: 84, consensusScore: 0.82, volatilityScore: 0.25, maxDrawdownPercent: 4, strategyDiversity: 0.65, operatorStable: true, occurredAtEpochMs: 1717200011000 },
    { sessionId: 'sess-003', tableId: 'mesa-201', outcome: 'PAPER_OBSERVAR', confidence: 70, consensusScore: 0.72, volatilityScore: 0.35, maxDrawdownPercent: 5, strategyDiversity: 0.6, operatorStable: true, occurredAtEpochMs: 1717200012000 },
    { sessionId: 'sess-004', tableId: 'mesa-201', outcome: 'PAPER_FAVORAVEL', confidence: 88, consensusScore: 0.9, volatilityScore: 0.18, maxDrawdownPercent: 2, strategyDiversity: 0.75, operatorStable: true, occurredAtEpochMs: 1717200013000 },
  ];
}

test('TableReputationEngine returns strong reputation for stable table history', () => {
  const result = new TableReputationEngine().evaluate({
    tableId: 'mesa-201',
    nowEpochMs: 1717200040000,
    records: strongRecords(),
    policy: policy(),
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.decision, 'TABLE_REPUTATION_STRONG');
  assert.equal(result.value.suggestedWeight > 1, true);
  assert.equal(result.value.productionMoneyAllowed, false);
  assert.equal(result.value.liveMoneyAuthorization, false);
});

test('TableReputationEngine returns neutral for insufficient matching table history', () => {
  const result = new TableReputationEngine().evaluate({
    tableId: 'mesa-nova-201',
    nowEpochMs: 1717200040000,
    records: strongRecords(),
    policy: policy(),
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.decision, 'TABLE_REPUTATION_NEUTRAL');
  assert.equal(result.value.suggestedWeight, 1);
});

test('TableReputationEngine blocks repeated negative table history', () => {
  const result = new TableReputationEngine().evaluate({
    tableId: 'mesa-ruim-201',
    nowEpochMs: 1717200040000,
    records: [
      { sessionId: 'sess-001', tableId: 'mesa-ruim-201', outcome: 'PAPER_NAO_UTILIZAR', confidence: 35, consensusScore: 0.2, volatilityScore: 0.8, maxDrawdownPercent: 18, strategyDiversity: 0.2, operatorStable: false, occurredAtEpochMs: 1717200010000 },
      { sessionId: 'sess-002', tableId: 'mesa-ruim-201', outcome: 'PAPER_NAO_UTILIZAR', confidence: 30, consensusScore: 0.25, volatilityScore: 0.85, maxDrawdownPercent: 20, strategyDiversity: 0.2, operatorStable: false, occurredAtEpochMs: 1717200011000 },
      { sessionId: 'sess-003', tableId: 'mesa-ruim-201', outcome: 'PAPER_OBSERVAR', confidence: 50, consensusScore: 0.4, volatilityScore: 0.75, maxDrawdownPercent: 16, strategyDiversity: 0.3, operatorStable: true, occurredAtEpochMs: 1717200012000 },
    ],
    policy: policy(),
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.decision, 'TABLE_REPUTATION_BLOCKING');
  assert.equal(result.value.suggestedWeight, 0.5);
});

test('TableReputationEngine returns volatile for high volatility without full block', () => {
  const result = new TableReputationEngine().evaluate({
    tableId: 'mesa-volatil-201',
    nowEpochMs: 1717200040000,
    records: [
      { sessionId: 'sess-001', tableId: 'mesa-volatil-201', outcome: 'PAPER_FAVORAVEL', confidence: 80, consensusScore: 0.75, volatilityScore: 0.7, maxDrawdownPercent: 8, strategyDiversity: 0.5, operatorStable: true, occurredAtEpochMs: 1717200010000 },
      { sessionId: 'sess-002', tableId: 'mesa-volatil-201', outcome: 'PAPER_OBSERVAR', confidence: 70, consensusScore: 0.7, volatilityScore: 0.65, maxDrawdownPercent: 9, strategyDiversity: 0.5, operatorStable: true, occurredAtEpochMs: 1717200011000 },
      { sessionId: 'sess-003', tableId: 'mesa-volatil-201', outcome: 'PAPER_FAVORAVEL', confidence: 82, consensusScore: 0.76, volatilityScore: 0.7, maxDrawdownPercent: 8, strategyDiversity: 0.5, operatorStable: true, occurredAtEpochMs: 1717200012000 },
    ],
    policy: policy(),
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.decision, 'TABLE_REPUTATION_VOLATILE');
  assert.equal(result.value.suggestedWeight < 1, true);
});

test('TableReputationEngine rejects live money before structural validation', () => {
  const result = new TableReputationEngine().evaluate({
    tableId: 'mesa-live-201',
    nowEpochMs: 1717200040000,
    records: [
      { sessionId: 'x', tableId: 'mesa-live-201', outcome: 'PAPER_FAVORAVEL', confidence: 90, consensusScore: 0.9, volatilityScore: 0.2, maxDrawdownPercent: 2, strategyDiversity: 0.8, operatorStable: true, occurredAtEpochMs: 1 },
    ],
    policy: policy(),
    productionMoneyAllowed: true,
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.reason, 'LIVE_MONEY_FORBIDDEN');
  assert.equal(result.error.productionMoneyAllowed, false);
  assert.equal(result.error.liveMoneyAuthorization, false);
});

test('TableReputationEngine rejects malformed record', () => {
  const result = new TableReputationEngine().evaluate({
    tableId: 'mesa-invalid-201',
    nowEpochMs: 1717200040000,
    records: [
      { sessionId: 'x', tableId: 'mesa-invalid-201', outcome: 'PAPER_FAVORAVEL', confidence: 90, consensusScore: 0.9, volatilityScore: 0.2, maxDrawdownPercent: 2, strategyDiversity: 0.8, operatorStable: true, occurredAtEpochMs: 1 },
    ],
    policy: policy(),
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.reason, 'INVALID_TABLE_REPUTATION_INPUT');
});

test('table-reputation-demo emits strong table reputation report', () => {
  const result = spawnSync(process.execPath, ['scripts/table-reputation-demo.js'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);

  assert.equal(payload.tableId, 'mesa-demo');
  assert.equal(payload.decision, 'TABLE_REPUTATION_STRONG');
  assert.equal(payload.productionMoneyAllowed, false);
  assert.equal(payload.liveMoneyAuthorization, false);
});
