#!/usr/bin/env node
'use strict';

const { InstitutionalTrendAnalyzer } = require('../dist/infrastructure/paper-operational/institutional-trend-analyzer');

const analyzer = new InstitutionalTrendAnalyzer();

const result = analyzer.analyze({
  records: [
    { sessionId: 'sess-001', tableId: 'mesa-a', strategyId: 'fusion', finalStatus: 'PAPER_LEARNING_NEUTRAL', finalConfidence: 65, suggestionCount: 3, favorableSuggestionCount: 1, operatorStatus: 'OPERATOR_STABLE', consensusDecision: 'PAPER_CONSENSUS_OBSERVE', finishedAtEpochMs: 1717200100000 },
    { sessionId: 'sess-002', tableId: 'mesa-a', strategyId: 'fusion', finalStatus: 'PAPER_LEARNING_STABLE', finalConfidence: 74, suggestionCount: 3, favorableSuggestionCount: 2, operatorStatus: 'OPERATOR_STABLE', consensusDecision: 'PAPER_CONSENSUS_READY', finishedAtEpochMs: 1717200200000 },
    { sessionId: 'sess-003', tableId: 'mesa-a', strategyId: 'fusion', finalStatus: 'PAPER_LEARNING_STRONG', finalConfidence: 86, suggestionCount: 4, favorableSuggestionCount: 3, operatorStatus: 'OPERATOR_STABLE', consensusDecision: 'PAPER_CONSENSUS_READY', finishedAtEpochMs: 1717200300000 },
    { sessionId: 'sess-004', tableId: 'mesa-a', strategyId: 'fusion', finalStatus: 'PAPER_LEARNING_STRONG', finalConfidence: 89, suggestionCount: 4, favorableSuggestionCount: 3, operatorStatus: 'OPERATOR_STABLE', consensusDecision: 'PAPER_CONSENSUS_CERTIFIED', finishedAtEpochMs: 1717200400000 },
  ],
  policy: {
    minimumSessions: 4,
    maxSessions: 100,
    windowSize: 2,
    improvingDelta: 0.08,
    degradingDelta: 0.08,
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
  process.exitCode = result.value.globalTrend.direction === 'TREND_BLOCKING' ? 1 : 0;
}
