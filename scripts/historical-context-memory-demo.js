#!/usr/bin/env node
'use strict';

const { HistoricalContextMemoryEngine } = require('../dist/infrastructure/paper-operational/historical-context-memory-engine');

const engine = new HistoricalContextMemoryEngine();

const result = engine.evaluate({
  tableId: 'mesa-demo',
  strategyId: 'fusion',
  nowEpochMs: 1717200020000,
  records: [
    { sessionId: 'sess-001', tableId: 'mesa-demo', strategyId: 'fusion', outcome: 'FAVORAVEL', confidence: 86, netPnL: 10, maxDrawdownPercent: 3, consistencyScore: 0.8, occurredAtEpochMs: 1717200010000 },
    { sessionId: 'sess-002', tableId: 'mesa-demo', strategyId: 'fusion', outcome: 'FAVORAVEL', confidence: 84, netPnL: 8, maxDrawdownPercent: 4, consistencyScore: 0.76, occurredAtEpochMs: 1717200011000 },
    { sessionId: 'sess-003', tableId: 'mesa-demo', strategyId: 'fusion', outcome: 'OBSERVAR', confidence: 68, netPnL: 0, maxDrawdownPercent: 5, consistencyScore: 0.7, occurredAtEpochMs: 1717200012000 },
    { sessionId: 'sess-004', tableId: 'mesa-demo', strategyId: 'fusion', outcome: 'FAVORAVEL', confidence: 88, netPnL: 12, maxDrawdownPercent: 2, consistencyScore: 0.82, occurredAtEpochMs: 1717200013000 },
  ],
  policy: {
    minimumRecords: 3,
    maxRecords: 50,
    recentWindowMs: 120000,
    maxDrawdownPercentForSupport: 8,
    minimumConsistencyForSupport: 0.65,
    minimumMemoryConfidenceForSupport: 0.6,
  },
  productionMoneyAllowed: false,
  liveMoneyAuthorization: false,
});

if (!result.ok) {
  console.error(JSON.stringify({ ok: false, error: result.error }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify(result.value, null, 2));
  process.exitCode = result.value.decision === 'MEMORY_BLOCKING' ? 1 : 0;
}
