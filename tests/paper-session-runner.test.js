const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const {
  PaperSessionRunner,
} = require('../dist/infrastructure/paper-operational/paper-session-runner');

function startInput(overrides = {}) {
  return {
    command: 'START',
    sessionId: 'paper-runner-203',
    tableId: 'mesa-203',
    strategyId: 'fusion',
    nowEpochMs: 1717200050000,
    maxRounds: 200,
    ...overrides,
  };
}

function suggestionInput(state, overrides = {}) {
  return {
    command: 'SUGGEST',
    sessionId: 'paper-runner-203',
    tableId: 'mesa-203',
    strategyId: 'fusion',
    nowEpochMs: 1717200052000,
    maxRounds: 200,
    state,
    suggestion: {
      finalConfidence: 86.2,
      consensusDecision: 'PAPER_CONSENSUS_READY',
      confidenceDecision: 'PAPER_FAVORAVEL',
      strategyReputation: 'REPUTATION_STRONG',
      tableReputation: 'TABLE_REPUTATION_STRONG',
      readinessStatus: 'PAPER_READY',
      operatorStatus: 'OPERATOR_STABLE',
      explanationItems: ['Mesa favorável.', 'Operador estável.'],
    },
    ...overrides,
  };
}

test('PaperSessionRunner starts active paper session', () => {
  const result = new PaperSessionRunner().run(startInput());

  assert.equal(result.ok, true);
  assert.equal(result.value.state.lifecycle, 'ACTIVE');
  assert.equal(result.value.state.rounds.length, 0);
  assert.equal(result.value.productionMoneyAllowed, false);
  assert.equal(result.value.liveMoneyAuthorization, false);
});

test('PaperSessionRunner appends manual round', () => {
  const runner = new PaperSessionRunner();
  const start = runner.run(startInput());

  assert.equal(start.ok, true);

  const round = runner.run({
    command: 'ROUND',
    sessionId: 'paper-runner-203',
    tableId: 'mesa-203',
    strategyId: 'fusion',
    nowEpochMs: 1717200051000,
    maxRounds: 200,
    state: start.value.state,
    round: { number: 17, color: 'BLACK' },
  });

  assert.equal(round.ok, true);
  assert.equal(round.value.state.rounds.length, 1);
  assert.equal(round.value.state.rounds[0].number, 17);
  assert.equal(round.value.state.rounds[0].color, 'BLACK');
});

test('PaperSessionRunner composes manual institutional suggestion', () => {
  const runner = new PaperSessionRunner();
  const start = runner.run(startInput());

  assert.equal(start.ok, true);

  const result = runner.run(suggestionInput(start.value.state));

  assert.equal(result.ok, true);
  assert.equal(result.value.suggestion.status, 'PAPER_FAVORAVEL');
  assert.equal(result.value.suggestion.manualUseAllowed, true);
  assert.equal(result.value.suggestion.automaticExecutionAllowed, false);
});

test('PaperSessionRunner finishes active paper session', () => {
  const runner = new PaperSessionRunner();
  const start = runner.run(startInput());

  assert.equal(start.ok, true);

  const finish = runner.run({
    command: 'FINISH',
    sessionId: 'paper-runner-203',
    tableId: 'mesa-203',
    strategyId: 'fusion',
    nowEpochMs: 1717200053000,
    maxRounds: 200,
    state: start.value.state,
  });

  assert.equal(finish.ok, true);
  assert.equal(finish.value.state.lifecycle, 'FINISHED');
});

test('PaperSessionRunner rejects live money flags', () => {
  const result = new PaperSessionRunner().run(startInput({
    productionMoneyAllowed: true,
  }));

  assert.equal(result.ok, false);
  assert.equal(result.error.reason, 'LIVE_MONEY_FORBIDDEN');
  assert.equal(result.error.productionMoneyAllowed, false);
  assert.equal(result.error.liveMoneyAuthorization, false);
});

test('PaperSessionRunner rejects command after finished session', () => {
  const runner = new PaperSessionRunner();
  const start = runner.run(startInput());

  assert.equal(start.ok, true);

  const finish = runner.run({
    command: 'FINISH',
    sessionId: 'paper-runner-203',
    tableId: 'mesa-203',
    strategyId: 'fusion',
    nowEpochMs: 1717200053000,
    maxRounds: 200,
    state: start.value.state,
  });

  assert.equal(finish.ok, true);

  const round = runner.run({
    command: 'ROUND',
    sessionId: 'paper-runner-203',
    tableId: 'mesa-203',
    strategyId: 'fusion',
    nowEpochMs: 1717200054000,
    maxRounds: 200,
    state: finish.value.state,
    round: { number: 1, color: 'RED' },
  });

  assert.equal(round.ok, false);
  assert.equal(round.error.reason, 'INVALID_PAPER_SESSION_RUNNER_INPUT');
});

test('paper-session-runner-demo emits favorable manual suggestion', () => {
  const result = spawnSync(process.execPath, ['scripts/paper-session-runner-demo.js'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);

  assert.equal(payload.ok, true);
  assert.equal(payload.lifecycle, 'ACTIVE');
  assert.equal(payload.rounds, 1);
  assert.equal(payload.suggestion, 'PAPER_FAVORAVEL');
  assert.equal(payload.manualUseAllowed, true);
  assert.equal(payload.automaticExecutionAllowed, false);
  assert.equal(payload.productionMoneyAllowed, false);
  assert.equal(payload.liveMoneyAuthorization, false);
});
