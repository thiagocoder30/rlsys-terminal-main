const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const {
  InstitutionalLaboratoryRuntime,
} = require('../dist/infrastructure/paper-operational/institutional-laboratory-runtime');

function records() {
  return [
    { sessionId: 'sess-001', tableId: 'mesa-a', strategyId: 'fusion', finalStatus: 'PAPER_LEARNING_NEUTRAL', finalConfidence: 65, suggestionCount: 3, favorableSuggestionCount: 1, operatorStatus: 'OPERATOR_STABLE', consensusDecision: 'PAPER_CONSENSUS_OBSERVE', strategyReputation: 'REPUTATION_STABLE', tableReputation: 'TABLE_REPUTATION_STABLE', finishedAtEpochMs: 1717200100000 },
    { sessionId: 'sess-002', tableId: 'mesa-a', strategyId: 'fusion', finalStatus: 'PAPER_LEARNING_STABLE', finalConfidence: 74, suggestionCount: 3, favorableSuggestionCount: 2, operatorStatus: 'OPERATOR_STABLE', consensusDecision: 'PAPER_CONSENSUS_READY', strategyReputation: 'REPUTATION_STABLE', tableReputation: 'TABLE_REPUTATION_STABLE', finishedAtEpochMs: 1717200200000 },
    { sessionId: 'sess-003', tableId: 'mesa-a', strategyId: 'fusion', finalStatus: 'PAPER_LEARNING_STRONG', finalConfidence: 86, suggestionCount: 4, favorableSuggestionCount: 3, operatorStatus: 'OPERATOR_STABLE', consensusDecision: 'PAPER_CONSENSUS_READY', strategyReputation: 'REPUTATION_STRONG', tableReputation: 'TABLE_REPUTATION_STRONG', finishedAtEpochMs: 1717200300000 },
    { sessionId: 'sess-004', tableId: 'mesa-a', strategyId: 'fusion', finalStatus: 'PAPER_LEARNING_STRONG', finalConfidence: 89, suggestionCount: 4, favorableSuggestionCount: 3, operatorStatus: 'OPERATOR_STABLE', consensusDecision: 'PAPER_CONSENSUS_CERTIFIED', strategyReputation: 'REPUTATION_STRONG', tableReputation: 'TABLE_REPUTATION_STRONG', finishedAtEpochMs: 1717200400000 },
  ];
}

function policy() {
  return {
    minimumSessions: 4,
    maxSessions: 100,
    recentWindowMs: 3600000,
    trendWindowSize: 2,
    minimumStrongScore: 0.72,
    minimumStableScore: 0.58,
    blockingNegativeRate: 0.75,
  };
}

test('InstitutionalLaboratoryRuntime unifies intelligence trend and calibration', () => {
  const result = new InstitutionalLaboratoryRuntime().run({
    nowEpochMs: 1717201000000,
    records: records(),
    policy: policy(),
    calibration: {
      strategyId: 'fusion',
      tableId: 'mesa-a',
      baseConfidence: 82,
      operatorStatus: 'OPERATOR_STABLE',
      consensusDecision: 'PAPER_CONSENSUS_READY',
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.usedSessions, 4);
  assert.equal(result.value.strongestStrategy, 'fusion');
  assert.equal(result.value.strongestTable, 'mesa-a');
  assert.equal(result.value.globalTrend, 'TREND_IMPROVING');
  assert.equal(result.value.calibration.decision, 'CALIBRATION_BOOSTED');
  assert.equal(result.value.productionMoneyAllowed, false);
  assert.equal(result.value.liveMoneyAuthorization, false);
});

test('InstitutionalLaboratoryRuntime works without calibration request', () => {
  const result = new InstitutionalLaboratoryRuntime().run({
    nowEpochMs: 1717201000000,
    records: records(),
    policy: policy(),
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.calibration, undefined);
  assert.equal(result.value.productionMoneyAllowed, false);
});

test('InstitutionalLaboratoryRuntime returns blocking recommendation for bad history', () => {
  const result = new InstitutionalLaboratoryRuntime().run({
    nowEpochMs: 1717201000000,
    records: [
      { sessionId: 'bad-001', tableId: 'mesa-z', strategyId: 'fusion', finalStatus: 'PAPER_LEARNING_CAUTION', finalConfidence: 35, suggestionCount: 3, favorableSuggestionCount: 0, operatorStatus: 'OPERATOR_BLOCKED', consensusDecision: 'PAPER_CONSENSUS_BLOCKED', strategyReputation: 'REPUTATION_CAUTION', tableReputation: 'TABLE_REPUTATION_BLOCKING', finishedAtEpochMs: 1717200100000 },
      { sessionId: 'bad-002', tableId: 'mesa-z', strategyId: 'fusion', finalStatus: 'PAPER_LEARNING_CAUTION', finalConfidence: 38, suggestionCount: 3, favorableSuggestionCount: 0, operatorStatus: 'OPERATOR_BLOCKED', consensusDecision: 'PAPER_CONSENSUS_BLOCKED', strategyReputation: 'REPUTATION_CAUTION', tableReputation: 'TABLE_REPUTATION_BLOCKING', finishedAtEpochMs: 1717200200000 },
      { sessionId: 'bad-003', tableId: 'mesa-z', strategyId: 'fusion', finalStatus: 'PAPER_LEARNING_CAUTION', finalConfidence: 40, suggestionCount: 3, favorableSuggestionCount: 0, operatorStatus: 'OPERATOR_BLOCKED', consensusDecision: 'PAPER_CONSENSUS_BLOCKED', strategyReputation: 'REPUTATION_CAUTION', tableReputation: 'TABLE_REPUTATION_BLOCKING', finishedAtEpochMs: 1717200300000 },
      { sessionId: 'bad-004', tableId: 'mesa-z', strategyId: 'fusion', finalStatus: 'PAPER_LEARNING_CAUTION', finalConfidence: 42, suggestionCount: 3, favorableSuggestionCount: 0, operatorStatus: 'OPERATOR_BLOCKED', consensusDecision: 'PAPER_CONSENSUS_BLOCKED', strategyReputation: 'REPUTATION_CAUTION', tableReputation: 'TABLE_REPUTATION_BLOCKING', finishedAtEpochMs: 1717200400000 },
    ],
    policy: policy(),
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.recommendation.includes('Bloquear'), true);
});

test('InstitutionalLaboratoryRuntime rejects live money before structural validation', () => {
  const result = new InstitutionalLaboratoryRuntime().run({
    nowEpochMs: 1717201000000,
    records: records(),
    policy: policy(),
    productionMoneyAllowed: true,
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.reason, 'LIVE_MONEY_FORBIDDEN');
  assert.equal(result.error.productionMoneyAllowed, false);
  assert.equal(result.error.liveMoneyAuthorization, false);
});

test('InstitutionalLaboratoryRuntime rejects malformed calibration', () => {
  const result = new InstitutionalLaboratoryRuntime().run({
    nowEpochMs: 1717201000000,
    records: records(),
    policy: policy(),
    calibration: {
      strategyId: 'x',
      tableId: 'mesa-a',
      baseConfidence: 82,
      operatorStatus: 'OPERATOR_STABLE',
      consensusDecision: 'PAPER_CONSENSUS_READY',
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.reason, 'INVALID_INSTITUTIONAL_LABORATORY_INPUT');
});

test('institutional-laboratory-runtime-demo emits unified report', () => {
  const result = spawnSync(process.execPath, ['scripts/institutional-laboratory-runtime-demo.js'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);

  assert.equal(payload.strongestStrategy, 'fusion');
  assert.equal(payload.strongestTable, 'mesa-a');
  assert.equal(payload.globalTrend, 'TREND_IMPROVING');
  assert.equal(payload.calibration.decision, 'CALIBRATION_BOOSTED');
  assert.equal(payload.productionMoneyAllowed, false);
  assert.equal(payload.liveMoneyAuthorization, false);
});
