#!/usr/bin/env node
'use strict';

const { PaperSessionRunner } = require('../dist/infrastructure/paper-operational/paper-session-runner');

const runner = new PaperSessionRunner();

const start = runner.run({
  command: 'START',
  sessionId: 'paper-runner-demo',
  tableId: 'mesa-demo',
  strategyId: 'fusion',
  nowEpochMs: 1717200050000,
  maxRounds: 200,
  productionMoneyAllowed: false,
  liveMoneyAuthorization: false,
});

if (!start.ok) {
  console.error(JSON.stringify(start.error, null, 2));
  process.exit(1);
}

const round = runner.run({
  command: 'ROUND',
  sessionId: 'paper-runner-demo',
  tableId: 'mesa-demo',
  strategyId: 'fusion',
  nowEpochMs: 1717200051000,
  maxRounds: 200,
  state: start.value.state,
  round: { number: 17, color: 'BLACK' },
  productionMoneyAllowed: false,
  liveMoneyAuthorization: false,
});

if (!round.ok) {
  console.error(JSON.stringify(round.error, null, 2));
  process.exit(1);
}

const suggest = runner.run({
  command: 'SUGGEST',
  sessionId: 'paper-runner-demo',
  tableId: 'mesa-demo',
  strategyId: 'fusion',
  nowEpochMs: 1717200052000,
  maxRounds: 200,
  state: round.value.state,
  suggestion: {
    finalConfidence: 86.2,
    consensusDecision: 'PAPER_CONSENSUS_READY',
    confidenceDecision: 'PAPER_FAVORAVEL',
    strategyReputation: 'REPUTATION_STRONG',
    tableReputation: 'TABLE_REPUTATION_STRONG',
    readinessStatus: 'PAPER_READY',
    operatorStatus: 'OPERATOR_STABLE',
    explanationItems: [
      'Mesa favorável.',
      'Estratégia com reputação forte.',
      'Operador estável.',
    ],
  },
  productionMoneyAllowed: false,
  liveMoneyAuthorization: false,
});

if (!suggest.ok) {
  console.error(JSON.stringify(suggest.error, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  lifecycle: suggest.value.state.lifecycle,
  rounds: suggest.value.state.rounds.length,
  suggestion: suggest.value.suggestion ? suggest.value.suggestion.status : 'NONE',
  manualUseAllowed: suggest.value.suggestion ? suggest.value.suggestion.manualUseAllowed : false,
  automaticExecutionAllowed: false,
  productionMoneyAllowed: false,
  liveMoneyAuthorization: false,
}, null, 2));
