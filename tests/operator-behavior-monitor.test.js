const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const {
  OperatorBehaviorMonitor,
} = require('../dist/infrastructure/paper-operational/operator-behavior-monitor');

function policy(overrides = {}) {
  return {
    maxActionsPerMinute: 8,
    maxConsecutiveLossesBeforeCooldown: 3,
    maxRevengeWindowMs: 120000,
    maxRecoveryCount: 2,
    maxRiskScoreForStable: 0.25,
    maxRiskScoreForObserve: 0.5,
    maxRiskScoreForCooldown: 0.75,
    ...overrides,
  };
}

test('OperatorBehaviorMonitor classifies stable disciplined operator', () => {
  const result = new OperatorBehaviorMonitor().evaluate({
    operatorId: 'operator-194',
    sessionId: 'paper-behavior-194',
    events: [
      { eventId: 'evt-001', action: 'PREPARE', occurredAtEpochMs: 1 },
      { eventId: 'evt-002', action: 'OPEN_PAPER', occurredAtEpochMs: 3000 },
      { eventId: 'evt-003', action: 'SETTLE_WIN', result: 'WIN', occurredAtEpochMs: 6000 },
      { eventId: 'evt-004', action: 'SNAPSHOT', occurredAtEpochMs: 9000 },
      { eventId: 'evt-005', action: 'FINISH', occurredAtEpochMs: 12000 },
    ],
    policy: policy(),
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.readiness, 'OPERATOR_STABLE');
  assert.equal(result.value.productionMoneyAllowed, false);
  assert.equal(result.value.liveMoneyAuthorization, false);
});

test('OperatorBehaviorMonitor detects revenge pattern after loss', () => {
  const result = new OperatorBehaviorMonitor().evaluate({
    operatorId: 'operator-revenge-194',
    sessionId: 'paper-behavior-revenge-194',
    events: [
      { eventId: 'evt-001', action: 'OPEN_PAPER', occurredAtEpochMs: 1 },
      { eventId: 'evt-002', action: 'SETTLE_LOSS', result: 'LOSS', occurredAtEpochMs: 2000 },
      { eventId: 'evt-003', action: 'OPEN_PAPER', occurredAtEpochMs: 3000 },
      { eventId: 'evt-004', action: 'SETTLE_LOSS', result: 'LOSS', occurredAtEpochMs: 4000 },
      { eventId: 'evt-005', action: 'OPEN_PAPER', occurredAtEpochMs: 5000 },
    ],
    policy: policy({ maxRiskScoreForStable: 0.1, maxRiskScoreForObserve: 0.2 }),
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.revengePatternCount, 2);
  assert.equal(result.value.readiness === 'OPERATOR_COOLDOWN' || result.value.readiness === 'OPERATOR_BLOCKED', true);
});

test('OperatorBehaviorMonitor blocks excessive consecutive losses', () => {
  const result = new OperatorBehaviorMonitor().evaluate({
    operatorId: 'operator-losses-194',
    sessionId: 'paper-behavior-losses-194',
    events: [
      { eventId: 'evt-001', action: 'SETTLE_LOSS', result: 'LOSS', occurredAtEpochMs: 1 },
      { eventId: 'evt-002', action: 'SETTLE_LOSS', result: 'LOSS', occurredAtEpochMs: 2 },
      { eventId: 'evt-003', action: 'SETTLE_LOSS', result: 'LOSS', occurredAtEpochMs: 3 },
      { eventId: 'evt-004', action: 'SETTLE_LOSS', result: 'LOSS', occurredAtEpochMs: 4 },
    ],
    policy: policy({ maxConsecutiveLossesBeforeCooldown: 3 }),
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.maxConsecutiveLosses, 4);
  assert.equal(result.value.readiness, 'OPERATOR_BLOCKED');
});

test('OperatorBehaviorMonitor detects overtrading burst', () => {
  const result = new OperatorBehaviorMonitor().evaluate({
    operatorId: 'operator-burst-194',
    sessionId: 'paper-behavior-burst-194',
    events: [
      { eventId: 'evt-001', action: 'STATUS', occurredAtEpochMs: 1 },
      { eventId: 'evt-002', action: 'STATUS', occurredAtEpochMs: 2 },
      { eventId: 'evt-003', action: 'STATUS', occurredAtEpochMs: 3 },
      { eventId: 'evt-004', action: 'STATUS', occurredAtEpochMs: 4 },
      { eventId: 'evt-005', action: 'STATUS', occurredAtEpochMs: 5 },
    ],
    policy: policy({ maxActionsPerMinute: 3 }),
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.actionBursts, 1);
  assert.equal(result.value.overtradingScore > 0, true);
});

test('OperatorBehaviorMonitor rejects live money flags before structural validation', () => {
  const result = new OperatorBehaviorMonitor().evaluate({
    operatorId: 'operator-live-194',
    sessionId: 'paper-behavior-live-194',
    events: [
      { eventId: 'x', action: 'STATUS', occurredAtEpochMs: 1 },
    ],
    policy: policy(),
    productionMoneyAllowed: true,
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.reason, 'LIVE_MONEY_FORBIDDEN');
  assert.equal(result.error.productionMoneyAllowed, false);
  assert.equal(result.error.liveMoneyAuthorization, false);
});

test('OperatorBehaviorMonitor rejects malformed event', () => {
  const result = new OperatorBehaviorMonitor().evaluate({
    operatorId: 'operator-invalid-194',
    sessionId: 'paper-behavior-invalid-194',
    events: [
      { eventId: 'x', action: 'STATUS', occurredAtEpochMs: 1 },
    ],
    policy: policy(),
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.reason, 'INVALID_OPERATOR_BEHAVIOR_INPUT');
});

test('operator-behavior-monitor-demo emits stable report', () => {
  const result = spawnSync(process.execPath, ['scripts/operator-behavior-monitor-demo.js'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);

  assert.equal(payload.operatorId, 'operator-demo');
  assert.equal(payload.readiness, 'OPERATOR_STABLE');
  assert.equal(payload.productionMoneyAllowed, false);
  assert.equal(payload.liveMoneyAuthorization, false);
});
