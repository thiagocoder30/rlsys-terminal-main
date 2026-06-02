#!/usr/bin/env node
'use strict';

const { PaperPerformanceAnalyzer } = require('../dist/infrastructure/paper-operational/paper-performance-analyzer');

const analyzer = new PaperPerformanceAnalyzer();

const result = analyzer.analyze({
  sessionId: 'paper-performance-demo',
  initialBalance: 100,
  trades: [
    { tradeId: 'trd-001', outcome: 'WIN', stake: 5, pnl: 5, closedAtEpochMs: 1717200004001 },
    { tradeId: 'trd-002', outcome: 'LOSS', stake: 5, pnl: -5, closedAtEpochMs: 1717200004002 },
    { tradeId: 'trd-003', outcome: 'WIN', stake: 5, pnl: 5, closedAtEpochMs: 1717200004003 },
    { tradeId: 'trd-004', outcome: 'PUSH', stake: 5, pnl: 0, closedAtEpochMs: 1717200004004 },
    { tradeId: 'trd-005', outcome: 'WIN', stake: 5, pnl: 5, closedAtEpochMs: 1717200004005 },
  ],
  policy: {
    minimumTrades: 5,
    maxDrawdownPercent: 10,
    minimumConsistencyScore: 0.5,
    minimumExpectancy: 0,
    minimumRecoveryFactor: 1,
  },
  productionMoneyAllowed: false,
  liveMoneyAuthorization: false,
});

if (!result.ok) {
  console.error(JSON.stringify({ ok: false, error: result.error }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify(result.value, null, 2));
  process.exitCode = result.value.certificationImpact === 'CERTIFICATION_BLOCKING' ? 1 : 0;
}
