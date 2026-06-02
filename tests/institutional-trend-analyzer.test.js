const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const {
  InstitutionalTrendAnalyzer,
} = require('../dist/infrastructure/paper-operational/institutional-trend-analyzer');

function policy(overrides = {}) {
  return {
    minimumSessions: 4,
    maxSessions: 100,
    windowSize: 2,
    improvingDelta: 0.08,
    degradingDelta: 0.08,
    blockingNegativeRate: 0.75,
    ...overrides,
  };
}

function improvingRecords() {
  return [
    { sessionId: 'sess-001', tableId: 'mesa-a', strategyId: 'fusion', finalStatus: 'PAPER_LEARNING_NEUTRAL', finalConfidence: 65, suggestionCount: 3, favorableSuggestionCount: 1, operatorStatus: 'OPERATOR_STABLE', consensusDecision: 'PAPER_CONSENSUS_OBSERVE', finishedAtEpochMs: 1717200100000 },
    { sessionId: 'sess-002', tableId: 'mesa-a', strategyId: 'fusion', finalStatus: 'PAPER_LEARNING_STABLE', finalConfidence: 74, suggestionCount: 3, favorableSuggestionCount: 2, operatorStatus: 'OPERATOR_STABLE', consensusDecision: 'PAPER_CONSENSUS_READY', finishedAtEpochMs: 1717200200000 },
    { sessionId: 'sess-003', tableId: 'mesa-a', strategyId: 'fusion', finalStatus: 'PAPER_LEARNING_STRONG', finalConfidence: 86, suggestionCount: 4, favorableSuggestionCount: 3, operatorStatus: 'OPERATOR_STABLE', consensusDecision: 'PAPER_CONSENSUS_READY', finishedAtEpochMs: 1717200300000 },
    { sessionId: 'sess-004', tableId: 'mesa-a', strategyId: 'fusion', finalStatus: 'PAPER_LEARNING_STRONG', finalConfidence: 89, suggestionCount: 4, favorableSuggestionCount: 3, operatorStatus: 'OPERATOR_STABLE', consensusDecision: 'PAPER_CONSENSUS_CERTIFIED', finishedAtEpochMs: 1717200400000 },
  ];
}

test('InstitutionalTrendAnalyzer detects improving global and strategy trend', () => {
  const result = new InstitutionalTrendAnalyzer().analyze({
    records: improvingRecords(),
    policy: policy(),
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.globalTrend.direction, 'TREND_IMPROVING');
  assert.equal(result.value.strategyTrends[0].key, 'fusion');
  assert.equal(result.value.strategyTrends[0].direction, 'TREND_IMPROVING');
  assert.equal(result.value.tableTrends[0].key, 'mesa-a');
  assert.equal(result.value.productionMoneyAllowed, false);
  assert.equal(result.value.liveMoneyAuthorization, false);
});

test('InstitutionalTrendAnalyzer detects degrading trend', () => {
  const result = new InstitutionalTrendAnalyzer().analyze({
    records: [...improvingRecords()].reverse().map((record, index) => ({
      ...record,
      sessionId: `deg-${index + 1}`,
      finishedAtEpochMs: 1717200100000 + index * 10000,
    })),
    policy: policy(),
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.globalTrend.direction, 'TREND_DEGRADING');
});

test('InstitutionalTrendAnalyzer detects blocking trend by negative rate', () => {
  const result = new InstitutionalTrendAnalyzer().analyze({
    records: [
      { sessionId: 'bad-001', tableId: 'mesa-z', strategyId: 'fusion', finalStatus: 'PAPER_LEARNING_CAUTION', finalConfidence: 40, suggestionCount: 3, favorableSuggestionCount: 0, operatorStatus: 'OPERATOR_BLOCKED', consensusDecision: 'PAPER_CONSENSUS_BLOCKED', finishedAtEpochMs: 1717200100000 },
      { sessionId: 'bad-002', tableId: 'mesa-z', strategyId: 'fusion', finalStatus: 'PAPER_LEARNING_CAUTION', finalConfidence: 42, suggestionCount: 3, favorableSuggestionCount: 0, operatorStatus: 'OPERATOR_BLOCKED', consensusDecision: 'PAPER_CONSENSUS_BLOCKED', finishedAtEpochMs: 1717200200000 },
      { sessionId: 'bad-003', tableId: 'mesa-z', strategyId: 'fusion', finalStatus: 'PAPER_LEARNING_CAUTION', finalConfidence: 43, suggestionCount: 3, favorableSuggestionCount: 0, operatorStatus: 'OPERATOR_BLOCKED', consensusDecision: 'PAPER_CONSENSUS_BLOCKED', finishedAtEpochMs: 1717200300000 },
      { sessionId: 'bad-004', tableId: 'mesa-z', strategyId: 'fusion', finalStatus: 'PAPER_LEARNING_CAUTION', finalConfidence: 45, suggestionCount: 3, favorableSuggestionCount: 0, operatorStatus: 'OPERATOR_BLOCKED', consensusDecision: 'PAPER_CONSENSUS_BLOCKED', finishedAtEpochMs: 1717200400000 },
    ],
    policy: policy(),
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.globalTrend.direction, 'TREND_BLOCKING');
});

test('InstitutionalTrendAnalyzer returns insufficient with too few sessions', () => {
  const result = new InstitutionalTrendAnalyzer().analyze({
    records: [improvingRecords()[0]],
    policy: policy(),
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.globalTrend.direction, 'TREND_INSUFFICIENT');
});

test('InstitutionalTrendAnalyzer rejects live money before structural validation', () => {
  const result = new InstitutionalTrendAnalyzer().analyze({
    records: [{ ...improvingRecords()[0], sessionId: 'x' }],
    policy: policy(),
    productionMoneyAllowed: true,
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.reason, 'LIVE_MONEY_FORBIDDEN');
  assert.equal(result.error.productionMoneyAllowed, false);
  assert.equal(result.error.liveMoneyAuthorization, false);
});

test('InstitutionalTrendAnalyzer rejects malformed record', () => {
  const result = new InstitutionalTrendAnalyzer().analyze({
    records: [{ ...improvingRecords()[0], sessionId: 'x' }],
    policy: policy(),
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.reason, 'INVALID_INSTITUTIONAL_TREND_INPUT');
});

test('institutional-trend-analyzer-demo emits improving trend report', () => {
  const result = spawnSync(process.execPath, ['scripts/institutional-trend-analyzer-demo.js'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);

  assert.equal(payload.globalTrend.direction, 'TREND_IMPROVING');
  assert.equal(payload.strategyTrends[0].key, 'fusion');
  assert.equal(payload.productionMoneyAllowed, false);
  assert.equal(payload.liveMoneyAuthorization, false);
});
