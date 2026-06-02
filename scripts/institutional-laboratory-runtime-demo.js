#!/usr/bin/env node
'use strict';

const { InstitutionalLaboratoryRuntime } = require('../dist/infrastructure/paper-operational/institutional-laboratory-runtime');

const runtime = new InstitutionalLaboratoryRuntime();

const result = runtime.run({
  nowEpochMs: 1717201000000,
  records: [
    { sessionId: 'sess-001', tableId: 'mesa-a', strategyId: 'fusion', finalStatus: 'PAPER_LEARNING_NEUTRAL', finalConfidence: 65, suggestionCount: 3, favorableSuggestionCount: 1, operatorStatus: 'OPERATOR_STABLE', consensusDecision: 'PAPER_CONSENSUS_OBSERVE', strategyReputation: 'REPUTATION_STABLE', tableReputation: 'TABLE_REPUTATION_STABLE', finishedAtEpochMs: 1717200100000 },
    { sessionId: 'sess-002', tableId: 'mesa-a', strategyId: 'fusion', finalStatus: 'PAPER_LEARNING_STABLE', finalConfidence: 74, suggestionCount: 3, favorableSuggestionCount: 2, operatorStatus: 'OPERATOR_STABLE', consensusDecision: 'PAPER_CONSENSUS_READY', strategyReputation: 'REPUTATION_STABLE', tableReputation: 'TABLE_REPUTATION_STABLE', finishedAtEpochMs: 1717200200000 },
    { sessionId: 'sess-003', tableId: 'mesa-a', strategyId: 'fusion', finalStatus: 'PAPER_LEARNING_STRONG', finalConfidence: 86, suggestionCount: 4, favorableSuggestionCount: 3, operatorStatus: 'OPERATOR_STABLE', consensusDecision: 'PAPER_CONSENSUS_READY', strategyReputation: 'REPUTATION_STRONG', tableReputation: 'TABLE_REPUTATION_STRONG', finishedAtEpochMs: 1717200300000 },
    { sessionId: 'sess-004', tableId: 'mesa-a', strategyId: 'fusion', finalStatus: 'PAPER_LEARNING_STRONG', finalConfidence: 89, suggestionCount: 4, favorableSuggestionCount: 3, operatorStatus: 'OPERATOR_STABLE', consensusDecision: 'PAPER_CONSENSUS_CERTIFIED', strategyReputation: 'REPUTATION_STRONG', tableReputation: 'TABLE_REPUTATION_STRONG', finishedAtEpochMs: 1717200400000 },
  ],
  policy: {
    minimumSessions: 4,
    maxSessions: 100,
    recentWindowMs: 3600000,
    trendWindowSize: 2,
    minimumStrongScore: 0.72,
    minimumStableScore: 0.58,
    blockingNegativeRate: 0.75,
  },
  calibration: {
    strategyId: 'fusion',
    tableId: 'mesa-a',
    baseConfidence: 82,
    operatorStatus: 'OPERATOR_STABLE',
    consensusDecision: 'PAPER_CONSENSUS_READY',
  },
  productionMoneyAllowed: false,
  liveMoneyAuthorization: false,
});

if (!result.ok) {
  console.error(JSON.stringify({ ok: false, error: result.error }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify(result.value, null, 2));
  process.exitCode = result.value.productionMoneyAllowed || result.value.liveMoneyAuthorization ? 1 : 0;
}
