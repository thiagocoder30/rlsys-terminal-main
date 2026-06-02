const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const {
  CrossSessionIntelligenceEngine,
} = require('../dist/infrastructure/paper-operational/cross-session-intelligence-engine');

function policy(overrides = {}) {
  return {
    minimumSessions: 2,
    maxSessions: 100,
    recentWindowMs: 3600000,
    minimumStrongScore: 0.72,
    minimumStableScore: 0.58,
    blockingNegativeRate: 0.75,
    ...overrides,
  };
}

function records() {
  return [
    { sessionId: 'sess-001', tableId: 'mesa-a', strategyId: 'fusion', finalStatus: 'PAPER_LEARNING_STRONG', finalConfidence: 86, suggestionCount: 4, favorableSuggestionCount: 3, operatorStatus: 'OPERATOR_STABLE', consensusDecision: 'PAPER_CONSENSUS_READY', strategyReputation: 'REPUTATION_STRONG', tableReputation: 'TABLE_REPUTATION_STRONG', finishedAtEpochMs: 1717200100000 },
    { sessionId: 'sess-002', tableId: 'mesa-a', strategyId: 'fusion', finalStatus: 'PAPER_LEARNING_STABLE', finalConfidence: 80, suggestionCount: 3, favorableSuggestionCount: 2, operatorStatus: 'OPERATOR_STABLE', consensusDecision: 'PAPER_CONSENSUS_READY', strategyReputation: 'REPUTATION_STRONG', tableReputation: 'TABLE_REPUTATION_STRONG', finishedAtEpochMs: 1717200200000 },
    { sessionId: 'sess-003', tableId: 'mesa-b', strategyId: 'triplicacao', finalStatus: 'PAPER_LEARNING_CAUTION', finalConfidence: 48, suggestionCount: 2, favorableSuggestionCount: 0, operatorStatus: 'OPERATOR_COOLDOWN', consensusDecision: 'PAPER_CONSENSUS_OBSERVE', strategyReputation: 'REPUTATION_CAUTION', tableReputation: 'TABLE_REPUTATION_VOLATILE', finishedAtEpochMs: 1717200300000 },
  ];
}

test('CrossSessionIntelligenceEngine consolidates strategies and tables', () => {
  const result = new CrossSessionIntelligenceEngine().analyze({
    nowEpochMs: 1717201000000,
    records: records(),
    policy: policy(),
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.usedSessions, 3);
  assert.equal(result.value.strategyIntelligence.length, 2);
  assert.equal(result.value.tableIntelligence.length, 2);
  assert.equal(result.value.strongestStrategy.key, 'fusion');
  assert.equal(result.value.strongestTable.key, 'mesa-a');
  assert.equal(result.value.productionMoneyAllowed, false);
  assert.equal(result.value.liveMoneyAuthorization, false);
});

test('CrossSessionIntelligenceEngine returns neutral for insufficient sessions', () => {
  const result = new CrossSessionIntelligenceEngine().analyze({
    nowEpochMs: 1717201000000,
    records: [records()[0]],
    policy: policy({ minimumSessions: 3 }),
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.globalDecision, 'CROSS_SESSION_NEUTRAL');
  assert.equal(result.value.strategyIntelligence.length, 0);
});

test('CrossSessionIntelligenceEngine returns blocking for strongly negative population', () => {
  const result = new CrossSessionIntelligenceEngine().analyze({
    nowEpochMs: 1717201000000,
    records: [
      { sessionId: 'bad-001', tableId: 'mesa-z', strategyId: 'fusion', finalStatus: 'PAPER_LEARNING_CAUTION', finalConfidence: 30, suggestionCount: 3, favorableSuggestionCount: 0, operatorStatus: 'OPERATOR_BLOCKED', consensusDecision: 'PAPER_CONSENSUS_BLOCKED', strategyReputation: 'REPUTATION_CAUTION', tableReputation: 'TABLE_REPUTATION_BLOCKING', finishedAtEpochMs: 1717200100000 },
      { sessionId: 'bad-002', tableId: 'mesa-z', strategyId: 'fusion', finalStatus: 'PAPER_LEARNING_CAUTION', finalConfidence: 35, suggestionCount: 3, favorableSuggestionCount: 0, operatorStatus: 'OPERATOR_BLOCKED', consensusDecision: 'PAPER_CONSENSUS_BLOCKED', strategyReputation: 'REPUTATION_CAUTION', tableReputation: 'TABLE_REPUTATION_BLOCKING', finishedAtEpochMs: 1717200200000 },
    ],
    policy: policy(),
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.globalDecision, 'CROSS_SESSION_BLOCKING');
  assert.equal(result.value.strongestStrategy.decision, 'CROSS_SESSION_BLOCKING');
});

test('CrossSessionIntelligenceEngine rejects live money flags before structural validation', () => {
  const result = new CrossSessionIntelligenceEngine().analyze({
    nowEpochMs: 1717201000000,
    records: [
      { ...records()[0], sessionId: 'x' },
    ],
    policy: policy(),
    productionMoneyAllowed: true,
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.reason, 'LIVE_MONEY_FORBIDDEN');
  assert.equal(result.error.productionMoneyAllowed, false);
  assert.equal(result.error.liveMoneyAuthorization, false);
});

test('CrossSessionIntelligenceEngine rejects malformed record', () => {
  const result = new CrossSessionIntelligenceEngine().analyze({
    nowEpochMs: 1717201000000,
    records: [
      { ...records()[0], sessionId: 'x' },
    ],
    policy: policy(),
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.reason, 'INVALID_CROSS_SESSION_INTELLIGENCE_INPUT');
});

test('cross-session-intelligence-demo emits consolidated report', () => {
  const result = spawnSync(process.execPath, ['scripts/cross-session-intelligence-demo.js'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);

  assert.equal(payload.usedSessions, 3);
  assert.equal(payload.strongestStrategy.key, 'fusion');
  assert.equal(payload.strongestTable.key, 'mesa-a');
  assert.equal(payload.productionMoneyAllowed, false);
  assert.equal(payload.liveMoneyAuthorization, false);
});
