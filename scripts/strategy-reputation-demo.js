#!/usr/bin/env node
'use strict';

const { StrategyReputationEngine } = require('../dist/infrastructure/paper-operational/strategy-reputation-engine');

const engine = new StrategyReputationEngine();

const result = engine.evaluate({
  strategyId: 'fusion',
  nowEpochMs: 1717200030000,
  records: [
    { sessionId: 'sess-001', strategyId: 'fusion', outcome: 'PAPER_FAVORAVEL', confidence: 84, finalConfidence: 88, netPnL: 10, maxDrawdownPercent: 3, operatorStable: true, consensusSupport: true, occurredAtEpochMs: 1717200010000 },
    { sessionId: 'sess-002', strategyId: 'fusion', outcome: 'PAPER_FAVORAVEL', confidence: 86, finalConfidence: 89, netPnL: 8, maxDrawdownPercent: 4, operatorStable: true, consensusSupport: true, occurredAtEpochMs: 1717200011000 },
    { sessionId: 'sess-003', strategyId: 'fusion', outcome: 'PAPER_OBSERVAR', confidence: 70, finalConfidence: 74, netPnL: 0, maxDrawdownPercent: 5, operatorStable: true, consensusSupport: true, occurredAtEpochMs: 1717200012000 },
    { sessionId: 'sess-004', strategyId: 'fusion', outcome: 'PAPER_FAVORAVEL', confidence: 88, finalConfidence: 91, netPnL: 12, maxDrawdownPercent: 2, operatorStable: true, consensusSupport: true, occurredAtEpochMs: 1717200013000 },
  ],
  policy: {
    minimumRecords: 3,
    maxRecords: 100,
    recentWindowMs: 120000,
    minimumStableRate: 0.7,
    minimumSupportRate: 0.7,
    maxDrawdownPercentForStable: 8,
    blockingDrawdownPercent: 15,
  },
  productionMoneyAllowed: false,
  liveMoneyAuthorization: false,
});

if (!result.ok) {
  console.error(JSON.stringify({ ok: false, error: result.error }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify(result.value, null, 2));
  process.exitCode = result.value.decision === 'REPUTATION_BLOCKING' ? 1 : 0;
}
