#!/usr/bin/env node
'use strict';

const { CrossSessionIntelligenceEngine } = require('../dist/infrastructure/paper-operational/cross-session-intelligence-engine');

const engine = new CrossSessionIntelligenceEngine();

const result = engine.analyze({
  nowEpochMs: 1717201000000,
  records: [
    { sessionId: 'sess-001', tableId: 'mesa-a', strategyId: 'fusion', finalStatus: 'PAPER_LEARNING_STRONG', finalConfidence: 86, suggestionCount: 4, favorableSuggestionCount: 3, operatorStatus: 'OPERATOR_STABLE', consensusDecision: 'PAPER_CONSENSUS_READY', strategyReputation: 'REPUTATION_STRONG', tableReputation: 'TABLE_REPUTATION_STRONG', finishedAtEpochMs: 1717200100000 },
    { sessionId: 'sess-002', tableId: 'mesa-a', strategyId: 'fusion', finalStatus: 'PAPER_LEARNING_STABLE', finalConfidence: 80, suggestionCount: 3, favorableSuggestionCount: 2, operatorStatus: 'OPERATOR_STABLE', consensusDecision: 'PAPER_CONSENSUS_READY', strategyReputation: 'REPUTATION_STRONG', tableReputation: 'TABLE_REPUTATION_STRONG', finishedAtEpochMs: 1717200200000 },
    { sessionId: 'sess-003', tableId: 'mesa-b', strategyId: 'triplicacao', finalStatus: 'PAPER_LEARNING_CAUTION', finalConfidence: 48, suggestionCount: 2, favorableSuggestionCount: 0, operatorStatus: 'OPERATOR_COOLDOWN', consensusDecision: 'PAPER_CONSENSUS_OBSERVE', strategyReputation: 'REPUTATION_CAUTION', tableReputation: 'TABLE_REPUTATION_VOLATILE', finishedAtEpochMs: 1717200300000 },
  ],
  policy: {
    minimumSessions: 2,
    maxSessions: 100,
    recentWindowMs: 3600000,
    minimumStrongScore: 0.72,
    minimumStableScore: 0.58,
    blockingNegativeRate: 0.75,
  },
  productionMoneyAllowed: false,
  liveMoneyAuthorization: false,
});

if (!result.ok) {
  console.error(JSON.stringify({ ok: false, error: result.error }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify(result.value, null, 2));
  process.exitCode = result.value.globalDecision === 'CROSS_SESSION_BLOCKING' ? 1 : 0;
}
