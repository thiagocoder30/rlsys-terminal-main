#!/usr/bin/env node
'use strict';

const { TableReputationEngine } = require('../dist/infrastructure/paper-operational/table-reputation-engine');

const engine = new TableReputationEngine();

const result = engine.evaluate({
  tableId: 'mesa-demo',
  nowEpochMs: 1717200040000,
  records: [
    { sessionId: 'sess-001', tableId: 'mesa-demo', outcome: 'PAPER_FAVORAVEL', confidence: 86, consensusScore: 0.86, volatilityScore: 0.2, maxDrawdownPercent: 3, strategyDiversity: 0.7, operatorStable: true, occurredAtEpochMs: 1717200010000 },
    { sessionId: 'sess-002', tableId: 'mesa-demo', outcome: 'PAPER_FAVORAVEL', confidence: 84, consensusScore: 0.82, volatilityScore: 0.25, maxDrawdownPercent: 4, strategyDiversity: 0.65, operatorStable: true, occurredAtEpochMs: 1717200011000 },
    { sessionId: 'sess-003', tableId: 'mesa-demo', outcome: 'PAPER_OBSERVAR', confidence: 70, consensusScore: 0.72, volatilityScore: 0.35, maxDrawdownPercent: 5, strategyDiversity: 0.6, operatorStable: true, occurredAtEpochMs: 1717200012000 },
    { sessionId: 'sess-004', tableId: 'mesa-demo', outcome: 'PAPER_FAVORAVEL', confidence: 88, consensusScore: 0.9, volatilityScore: 0.18, maxDrawdownPercent: 2, strategyDiversity: 0.75, operatorStable: true, occurredAtEpochMs: 1717200013000 },
  ],
  policy: {
    minimumRecords: 3,
    maxRecords: 100,
    recentWindowMs: 120000,
    maxVolatilityForStable: 0.4,
    maxDrawdownPercentForStable: 8,
    blockingDrawdownPercent: 15,
    minimumConsensusSupport: 0.7,
  },
  productionMoneyAllowed: false,
  liveMoneyAuthorization: false,
});

if (!result.ok) {
  console.error(JSON.stringify({ ok: false, error: result.error }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify(result.value, null, 2));
  process.exitCode = result.value.decision === 'TABLE_REPUTATION_BLOCKING' ? 1 : 0;
}
