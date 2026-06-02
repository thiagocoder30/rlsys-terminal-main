#!/usr/bin/env node
'use strict';

const path = require('node:path');
const { PaperReadinessGate } = require('../dist/infrastructure/paper-operational/paper-readiness-gate');

const filePath = process.env.RLSYS_PAPER_READINESS_STATE_PATH
  || path.join(process.cwd(), 'data', 'paper-operational', 'readiness-gate-session.json');

const gate = new PaperReadinessGate();

const result = gate.evaluate({
  filePath,
  operatorId: 'operator-demo',
  sessionId: 'paper-readiness-demo',
  tradeId: 'trade-readiness-demo',
  balance: 100,
  stake: 5,
  startedAtEpochMs: 1717200009000,
  maxBytes: 250000,
  minimumSuccessfulSteps: 10,
  minimumPersistedSteps: 8,
  requireAuditChain: true,
  minimumReadinessScoreForReady: 0.65,
  minimumReadinessScoreForCertified: 0.85,
  performanceTrades: [
    { tradeId: 'trd-001', outcome: 'WIN', stake: 5, pnl: 5, closedAtEpochMs: 1717200010001 },
    { tradeId: 'trd-002', outcome: 'LOSS', stake: 5, pnl: -5, closedAtEpochMs: 1717200010002 },
    { tradeId: 'trd-003', outcome: 'WIN', stake: 5, pnl: 5, closedAtEpochMs: 1717200010003 },
    { tradeId: 'trd-004', outcome: 'PUSH', stake: 5, pnl: 0, closedAtEpochMs: 1717200010004 },
    { tradeId: 'trd-005', outcome: 'WIN', stake: 5, pnl: 5, closedAtEpochMs: 1717200010005 },
  ],
  performancePolicy: {
    minimumTrades: 5,
    maxDrawdownPercent: 10,
    minimumConsistencyScore: 0.5,
    minimumExpectancy: 0,
    minimumRecoveryFactor: 1,
  },
  behaviorEvents: [
    { eventId: 'evt-001', action: 'PREPARE', occurredAtEpochMs: 1717200011001 },
    { eventId: 'evt-002', action: 'OPEN_PAPER', occurredAtEpochMs: 1717200012000 },
    { eventId: 'evt-003', action: 'SETTLE_WIN', result: 'WIN', occurredAtEpochMs: 1717200013000 },
    { eventId: 'evt-004', action: 'SNAPSHOT', occurredAtEpochMs: 1717200014000 },
    { eventId: 'evt-005', action: 'FINISH', occurredAtEpochMs: 1717200015000 },
  ],
  behaviorPolicy: {
    maxActionsPerMinute: 8,
    maxConsecutiveLossesBeforeCooldown: 3,
    maxRevengeWindowMs: 120000,
    maxRecoveryCount: 2,
    maxRiskScoreForStable: 0.25,
    maxRiskScoreForObserve: 0.5,
    maxRiskScoreForCooldown: 0.75,
  },
  productionMoneyAllowed: false,
  liveMoneyAuthorization: false,
});

if (!result.ok) {
  console.error(JSON.stringify({ ok: false, error: result.error }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({
    ok: true,
    status: result.value.status,
    reason: result.value.reason,
    paperAuthorized: result.value.paperAuthorized,
    certified: result.value.certified,
    readinessScore: result.value.readinessScore,
    productionMoneyAllowed: false,
    liveMoneyAuthorization: false,
  }, null, 2));
  process.exitCode = result.value.paperAuthorized ? 0 : 1;
}
