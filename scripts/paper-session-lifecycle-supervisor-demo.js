#!/usr/bin/env node
'use strict';

const path = require('node:path');
const { PaperSessionLifecycleSupervisor } = require('../dist/infrastructure/paper-operational/paper-session-lifecycle-supervisor');

const filePath = process.env.RLSYS_PAPER_LIFECYCLE_STATE_PATH
  || path.join(process.cwd(), 'data', 'paper-operational', 'lifecycle-session.json');

const supervisor = new PaperSessionLifecycleSupervisor();

const result = supervisor.supervise({
  filePath,
  operatorId: 'operator-demo',
  sessionId: 'paper-lifecycle-demo',
  tradeId: 'trade-lifecycle-demo',
  balance: 100,
  stake: 5,
  startedAtEpochMs: 1717200006000,
  maxBytes: 250000,
  minimumSuccessfulSteps: 10,
  minimumPersistedSteps: 8,
  requireAuditChain: true,
  performanceTrades: [
    { tradeId: 'trd-001', outcome: 'WIN', stake: 5, pnl: 5, closedAtEpochMs: 1717200007001 },
    { tradeId: 'trd-002', outcome: 'LOSS', stake: 5, pnl: -5, closedAtEpochMs: 1717200007002 },
    { tradeId: 'trd-003', outcome: 'WIN', stake: 5, pnl: 5, closedAtEpochMs: 1717200007003 },
    { tradeId: 'trd-004', outcome: 'PUSH', stake: 5, pnl: 0, closedAtEpochMs: 1717200007004 },
    { tradeId: 'trd-005', outcome: 'WIN', stake: 5, pnl: 5, closedAtEpochMs: 1717200007005 },
  ],
  performancePolicy: {
    minimumTrades: 5,
    maxDrawdownPercent: 10,
    minimumConsistencyScore: 0.5,
    minimumExpectancy: 0,
    minimumRecoveryFactor: 1,
  },
  behaviorEvents: [
    { eventId: 'evt-001', action: 'PREPARE', occurredAtEpochMs: 1717200008001 },
    { eventId: 'evt-002', action: 'OPEN_PAPER', occurredAtEpochMs: 1717200009000 },
    { eventId: 'evt-003', action: 'SETTLE_WIN', result: 'WIN', occurredAtEpochMs: 1717200010000 },
    { eventId: 'evt-004', action: 'SNAPSHOT', occurredAtEpochMs: 1717200011000 },
    { eventId: 'evt-005', action: 'FINISH', occurredAtEpochMs: 1717200012000 },
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
    decision: result.value.decision,
    reason: result.value.reason,
    readinessScore: result.value.readinessScore,
    certificationStatus: result.value.certificationStatus,
    performanceDecision: result.value.performanceDecision,
    behaviorReadiness: result.value.behaviorReadiness,
    productionMoneyAllowed: false,
    liveMoneyAuthorization: false,
  }, null, 2));
  process.exitCode = result.value.decision === 'PAPER_SESSION_BLOCKED' ? 1 : 0;
}
