const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const {
  SessionLearningEngine,
} = require('../dist/infrastructure/paper-operational/session-learning-engine');

function input(overrides = {}) {
  return {
    sessionId: 'paper-learning-205',
    tableId: 'mesa-205',
    strategyId: 'fusion',
    startedAtEpochMs: 1717200060000,
    finishedAtEpochMs: 1717200160000,
    roundCount: 24,
    operatorStatus: 'OPERATOR_STABLE',
    consensusDecision: 'PAPER_CONSENSUS_READY',
    strategyReputation: 'REPUTATION_STRONG',
    tableReputation: 'TABLE_REPUTATION_STRONG',
    suggestions: [
      { status: 'PAPER_FAVORAVEL', finalConfidence: 86, manualUseAllowed: true, occurredAtEpochMs: 1717200070000 },
      { status: 'PAPER_OBSERVAR', finalConfidence: 72, manualUseAllowed: false, occurredAtEpochMs: 1717200080000 },
      { status: 'PAPER_CERTIFICADO', finalConfidence: 89, manualUseAllowed: true, occurredAtEpochMs: 1717200090000 },
    ],
    ...overrides,
  };
}

test('SessionLearningEngine extracts institutional memory records', () => {
  const result = new SessionLearningEngine().analyze(input());

  assert.equal(result.ok, true);
  assert.equal(result.value.sessionRecord.sessionId, 'paper-learning-205');
  assert.equal(result.value.sessionRecord.finalStatus, 'PAPER_LEARNING_STRONG');
  assert.equal(result.value.strategyIndex.key, 'strategy:fusion');
  assert.equal(result.value.tableIndex.key, 'table:mesa-205');
  assert.equal(result.value.productionMoneyAllowed, false);
  assert.equal(result.value.liveMoneyAuthorization, false);
});

test('SessionLearningEngine returns caution for weak session', () => {
  const result = new SessionLearningEngine().analyze(input({
    consensusDecision: 'PAPER_CONSENSUS_BLOCKED',
    strategyReputation: 'REPUTATION_CAUTION',
    tableReputation: 'TABLE_REPUTATION_VOLATILE',
    operatorStatus: 'OPERATOR_COOLDOWN',
    suggestions: [
      { status: 'PAPER_NAO_UTILIZAR', finalConfidence: 35, manualUseAllowed: false, occurredAtEpochMs: 1717200070000 },
      { status: 'PAPER_OBSERVAR', finalConfidence: 55, manualUseAllowed: false, occurredAtEpochMs: 1717200080000 },
    ],
  }));

  assert.equal(result.ok, true);
  assert.equal(result.value.sessionRecord.finalStatus, 'PAPER_LEARNING_CAUTION');
  assert.equal(result.value.strategyIndex.decision, 'REPUTATION_CAUTION');
  assert.equal(result.value.tableIndex.decision, 'TABLE_REPUTATION_VOLATILE');
});

test('SessionLearningEngine handles empty suggestion session defensively', () => {
  const result = new SessionLearningEngine().analyze(input({
    suggestions: [],
  }));

  assert.equal(result.ok, true);
  assert.equal(result.value.sessionRecord.suggestionCount, 0);
  assert.equal(result.value.sessionRecord.finalStatus, 'PAPER_LEARNING_CAUTION');
});

test('SessionLearningEngine rejects live money flags before structural validation', () => {
  const result = new SessionLearningEngine().analyze(input({
    sessionId: 'x',
    productionMoneyAllowed: true,
  }));

  assert.equal(result.ok, false);
  assert.equal(result.error.reason, 'LIVE_MONEY_FORBIDDEN');
  assert.equal(result.error.productionMoneyAllowed, false);
  assert.equal(result.error.liveMoneyAuthorization, false);
});

test('SessionLearningEngine rejects malformed suggestion', () => {
  const result = new SessionLearningEngine().analyze(input({
    suggestions: [
      { status: 'x', finalConfidence: 101, manualUseAllowed: true, occurredAtEpochMs: 1 },
    ],
  }));

  assert.equal(result.ok, false);
  assert.equal(result.error.reason, 'INVALID_SESSION_LEARNING_INPUT');
});

test('session-learning-engine-demo emits learning report', () => {
  const result = spawnSync(process.execPath, ['scripts/session-learning-engine-demo.js'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);

  assert.equal(payload.sessionRecord.sessionId, 'paper-learning-demo');
  assert.equal(payload.strategyIndex.key, 'strategy:fusion');
  assert.equal(payload.tableIndex.key, 'table:mesa-demo');
  assert.equal(payload.productionMoneyAllowed, false);
  assert.equal(payload.liveMoneyAuthorization, false);
});
