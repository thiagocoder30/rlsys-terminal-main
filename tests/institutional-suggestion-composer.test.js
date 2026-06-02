const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const {
  InstitutionalSuggestionComposer,
} = require('../dist/infrastructure/paper-operational/institutional-suggestion-composer');

function baseInput(overrides = {}) {
  return {
    sessionId: 'paper-suggestion-202',
    tableId: 'mesa-202',
    strategyId: 'fusion',
    finalConfidence: 89.4,
    consensusDecision: 'PAPER_CONSENSUS_CERTIFIED',
    confidenceDecision: 'PAPER_CERTIFICADO',
    strategyReputation: 'REPUTATION_STRONG',
    tableReputation: 'TABLE_REPUTATION_STRONG',
    readinessStatus: 'PAPER_CERTIFIED',
    operatorStatus: 'OPERATOR_STABLE',
    explanationItems: [
      'Mesa com reputação forte.',
      'Estratégia com reputação forte.',
      'Operador estável.',
    ],
    ...overrides,
  };
}

test('InstitutionalSuggestionComposer returns certified manual suggestion', () => {
  const result = new InstitutionalSuggestionComposer().compose(baseInput());

  assert.equal(result.ok, true);
  assert.equal(result.value.status, 'PAPER_CERTIFICADO');
  assert.equal(result.value.manualUseAllowed, true);
  assert.equal(result.value.requiresHumanDecision, true);
  assert.equal(result.value.automaticExecutionAllowed, false);
  assert.equal(result.value.productionMoneyAllowed, false);
  assert.equal(result.value.liveMoneyAuthorization, false);
});

test('InstitutionalSuggestionComposer returns favorable when strong but not certified', () => {
  const result = new InstitutionalSuggestionComposer().compose(baseInput({
    finalConfidence: 84,
    consensusDecision: 'PAPER_CONSENSUS_READY',
    confidenceDecision: 'PAPER_FAVORAVEL',
  }));

  assert.equal(result.ok, true);
  assert.equal(result.value.status, 'PAPER_FAVORAVEL');
  assert.equal(result.value.manualUseAllowed, true);
});

test('InstitutionalSuggestionComposer returns observe for volatile table', () => {
  const result = new InstitutionalSuggestionComposer().compose(baseInput({
    tableReputation: 'TABLE_REPUTATION_VOLATILE',
  }));

  assert.equal(result.ok, true);
  assert.equal(result.value.status, 'PAPER_OBSERVAR');
  assert.equal(result.value.manualUseAllowed, false);
});

test('InstitutionalSuggestionComposer blocks on consensus blocked', () => {
  const result = new InstitutionalSuggestionComposer().compose(baseInput({
    consensusDecision: 'PAPER_CONSENSUS_BLOCKED',
  }));

  assert.equal(result.ok, true);
  assert.equal(result.value.status, 'PAPER_NAO_UTILIZAR');
  assert.equal(result.value.manualUseAllowed, false);
});

test('InstitutionalSuggestionComposer rejects live money flags', () => {
  const result = new InstitutionalSuggestionComposer().compose(baseInput({
    productionMoneyAllowed: true,
  }));

  assert.equal(result.ok, false);
  assert.equal(result.error.reason, 'LIVE_MONEY_FORBIDDEN');
  assert.equal(result.error.productionMoneyAllowed, false);
  assert.equal(result.error.liveMoneyAuthorization, false);
});

test('InstitutionalSuggestionComposer rejects malformed strategy id', () => {
  const result = new InstitutionalSuggestionComposer().compose(baseInput({
    strategyId: 'x',
  }));

  assert.equal(result.ok, false);
  assert.equal(result.error.reason, 'INVALID_INSTITUTIONAL_SUGGESTION_INPUT');
});

test('institutional-suggestion-composer-demo emits certified report', () => {
  const result = spawnSync(process.execPath, ['scripts/institutional-suggestion-composer-demo.js'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);

  assert.equal(payload.strategyId, 'fusion');
  assert.equal(payload.status, 'PAPER_CERTIFICADO');
  assert.equal(payload.manualUseAllowed, true);
  assert.equal(payload.requiresHumanDecision, true);
  assert.equal(payload.automaticExecutionAllowed, false);
  assert.equal(payload.productionMoneyAllowed, false);
  assert.equal(payload.liveMoneyAuthorization, false);
});
