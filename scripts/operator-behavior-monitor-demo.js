#!/usr/bin/env node
'use strict';

const { OperatorBehaviorMonitor } = require('../dist/infrastructure/paper-operational/operator-behavior-monitor');

const monitor = new OperatorBehaviorMonitor();

const result = monitor.evaluate({
  operatorId: 'operator-demo',
  sessionId: 'paper-behavior-demo',
  events: [
    { eventId: 'evt-001', action: 'PREPARE', occurredAtEpochMs: 1717200005001 },
    { eventId: 'evt-002', action: 'OPEN_PAPER', occurredAtEpochMs: 1717200007000 },
    { eventId: 'evt-003', action: 'SETTLE_WIN', result: 'WIN', occurredAtEpochMs: 1717200009000 },
    { eventId: 'evt-004', action: 'SNAPSHOT', occurredAtEpochMs: 1717200012000 },
    { eventId: 'evt-005', action: 'FINISH', occurredAtEpochMs: 1717200015000 },
  ],
  policy: {
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
  console.log(JSON.stringify(result.value, null, 2));
  process.exitCode = result.value.readiness === 'OPERATOR_BLOCKED' ? 1 : 0;
}
