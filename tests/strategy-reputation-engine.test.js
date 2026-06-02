const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const {
  StrategyReputationEngine,
} = require('../dist/infrastructure/paper-operational/strategy-reputation-engine');

function policy(overrides = {}) {
  return {
    minimumRecords: 3,
    maxRecords: 100,
    recentWindowMs: 120000,
    minimumStableRate: 0.7,
    minimumSupportRate: 0.7,
    maxDrawdownPercentForStable: 8,
    blockingDrawdownPercent: 15,
    ...overrides,
  };
}

function strongRecords() {
  return [
    { sessionId: 'sess-001', strategyId: 'fusion', outcome: 'PAPER_FAVORAVEL', confidence: 84, finalConfidence: 88, netPnL: 10, maxDrawdownPercent: 3, operatorStable: true, consensusSupport: true, occurredAtEpochMs: 1717200010000 },
    { sessionId: 'sess-002', strategyId: 'fusion', outcome: 'PAPER_FAVORAVEL', confidence: 86, finalConfidence: 89, netPnL: 8, maxDrawdownPercent: 4, operatorStable: true, consensusSupport: true, occurredAtEpochMs: 1717200011000 },
    { sessionId: 'sess-003', strategyId: 'fusion', outcome: 'PAPER_OBSERVAR', confidence: 70, finalConfidence: 74, netPnL: 0, maxDrawdownPercent: 5, operatorStable: true, consensusSupport: true, occurredAtEpochMs: 1717200012000 },
    { sessionId: 'sess-004', strategyId: 'fusion', outcome: 'PAPER_FAVORAVEL', confidence: 88, finalConfidence: 91, netPnL: 12, maxDrawdownPercent: 2, operatorStable: true, consensusSupport: true, occurredAtEpochMs: 1717200013000 },
  ];
}

test('StrategyReputationEngine returns strong reputation for stable Fusion history', () => {
  const result = new StrategyReputationEngine().evaluate({
    strategyId: 'fusion',
    nowEpochMs: 1717200030000,
    records: strongRecords(),
    policy: policy(),
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.decision, 'REPUTATION_STRONG');
  assert.equal(result.value.suggestedWeight > 1, true);
  assert.equal(result.value.productionMoneyAllowed, false);
  assert.equal(result.value.liveMoneyAuthorization, false);
});

test('StrategyReputationEngine returns neutral for insufficient history', () => {
  const result = new StrategyReputationEngine().evaluate({
    strategyId: 'triplicacao',
    nowEpochMs: 1717200030000,
    records: strongRecords(),
    policy: policy(),
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.decision, 'REPUTATION_NEUTRAL');
  assert.equal(result.value.suggestedWeight, 1);
});

test('StrategyReputationEngine blocks recurrent negative reputation', () => {
  const result = new StrategyReputationEngine().evaluate({
    strategyId: 'fusion',
    nowEpochMs: 1717200030000,
    records: [
      { sessionId: 'sess-001', strategyId: 'fusion', outcome: 'PAPER_NAO_UTILIZAR', confidence: 30, finalConfidence: 35, netPnL: -10, maxDrawdownPercent: 18, operatorStable: false, consensusSupport: false, occurredAtEpochMs: 1717200010000 },
      { sessionId: 'sess-002', strategyId: 'fusion', outcome: 'PAPER_NAO_UTILIZAR', confidence: 25, finalConfidence: 30, netPnL: -12, maxDrawdownPercent: 20, operatorStable: false, consensusSupport: false, occurredAtEpochMs: 1717200011000 },
      { sessionId: 'sess-003', strategyId: 'fusion', outcome: 'PAPER_OBSERVAR', confidence: 50, finalConfidence: 52, netPnL: -4, maxDrawdownPercent: 16, operatorStable: true, consensusSupport: false, occurredAtEpochMs: 1717200012000 },
    ],
    policy: policy(),
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.decision, 'REPUTATION_BLOCKING');
  assert.equal(result.value.suggestedWeight, 0.5);
});

test('StrategyReputationEngine returns caution on operator instability', () => {
  const result = new StrategyReputationEngine().evaluate({
    strategyId: 'fusion',
    nowEpochMs: 1717200030000,
    records: strongRecords().map((record, index) => ({
      ...record,
      operatorStable: index === 0,
    })),
    policy: policy(),
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.decision, 'REPUTATION_CAUTION');
  assert.equal(result.value.suggestedWeight < 1, true);
});

test('StrategyReputationEngine rejects live money before structural validation', () => {
  const result = new StrategyReputationEngine().evaluate({
    strategyId: 'fusion',
    nowEpochMs: 1717200030000,
    records: [
      { sessionId: 'x', strategyId: 'fusion', outcome: 'PAPER_FAVORAVEL', confidence: 90, finalConfidence: 90, netPnL: 10, maxDrawdownPercent: 2, operatorStable: true, consensusSupport: true, occurredAtEpochMs: 1 },
    ],
    policy: policy(),
    productionMoneyAllowed: true,
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.reason, 'LIVE_MONEY_FORBIDDEN');
  assert.equal(result.error.productionMoneyAllowed, false);
  assert.equal(result.error.liveMoneyAuthorization, false);
});

test('StrategyReputationEngine rejects malformed record', () => {
  const result = new StrategyReputationEngine().evaluate({
    strategyId: 'fusion',
    nowEpochMs: 1717200030000,
    records: [
      { sessionId: 'x', strategyId: 'fusion', outcome: 'PAPER_FAVORAVEL', confidence: 90, finalConfidence: 90, netPnL: 10, maxDrawdownPercent: 2, operatorStable: true, consensusSupport: true, occurredAtEpochMs: 1 },
    ],
    policy: policy(),
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.reason, 'INVALID_STRATEGY_REPUTATION_INPUT');
});

test('strategy-reputation-demo emits strong reputation report', () => {
  const result = spawnSync(process.execPath, ['scripts/strategy-reputation-demo.js'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);

  assert.equal(payload.strategyId, 'fusion');
  assert.equal(payload.decision, 'REPUTATION_STRONG');
  assert.equal(payload.productionMoneyAllowed, false);
  assert.equal(payload.liveMoneyAuthorization, false);
});
