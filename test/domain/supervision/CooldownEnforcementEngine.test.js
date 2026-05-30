'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { CooldownEnforcementEngine } = require('../../../src/domain/supervision/CooldownEnforcementEngine');

test('creates a non-violable cooldown lock with all gates blocked', () => {
  const engine = new CooldownEnforcementEngine({
    minDurationMs: 1000,
    defaultDurationMs: 5000,
    maxDurationMs: 10000
  });

  const result = engine.createLock({
    reason: 'session_blocked',
    nowMs: 1000,
    durationMs: 5000,
    sessionId: 'warmup-abc'
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.nonViolable, true);
  assert.equal(result.value.startedAtMs, 1000);
  assert.equal(result.value.expiresAtMs, 6000);
  assert.equal(result.value.operationalGate, 'BLOCKED');
  assert.equal(result.value.paperGate, 'BLOCKED');
  assert.equal(result.value.liveGate, 'BLOCKED');
  assert.equal(result.value.productionMoneyAllowed, false);
  assert.equal(result.value.liveMoneyAuthorized, false);
});

test('blocks session while cooldown is active', () => {
  const engine = new CooldownEnforcementEngine({
    minDurationMs: 1000,
    defaultDurationMs: 5000,
    maxDurationMs: 10000
  });

  const lockResult = engine.createLock({
    reason: 'session_blocked',
    nowMs: 1000,
    durationMs: 5000
  });

  const decision = engine.evaluate({
    lock: lockResult.value,
    nowMs: 3000
  });

  assert.equal(decision.status, 'ACTIVE');
  assert.equal(decision.blocked, true);
  assert.equal(decision.canStartSession, false);
  assert.equal(decision.remainingMs, 3000);
  assert.ok(decision.reasons.includes('cooldown_active'));
});

test('allows session evaluation only after cooldown expiration while gates remain defensive', () => {
  const engine = new CooldownEnforcementEngine({
    minDurationMs: 1000,
    defaultDurationMs: 5000,
    maxDurationMs: 10000
  });

  const lockResult = engine.createLock({
    reason: 'session_blocked',
    nowMs: 1000,
    durationMs: 5000
  });

  const decision = engine.evaluate({
    lock: lockResult.value,
    nowMs: 6000
  });

  assert.equal(decision.status, 'EXPIRED');
  assert.equal(decision.blocked, false);
  assert.equal(decision.canStartSession, true);
  assert.equal(decision.paperGate, 'BLOCKED');
  assert.equal(decision.liveGate, 'BLOCKED');
  assert.equal(decision.productionMoneyAllowed, false);
  assert.equal(decision.liveMoneyAuthorized, false);
});

test('returns not required when no cooldown lock exists', () => {
  const engine = new CooldownEnforcementEngine();

  const decision = engine.evaluate({
    nowMs: 1000
  });

  assert.equal(decision.status, 'NOT_REQUIRED');
  assert.equal(decision.blocked, false);
  assert.equal(decision.canStartSession, true);
  assert.equal(decision.liveGate, 'BLOCKED');
});

test('rejects attempt to evaluate a violable lock', () => {
  const engine = new CooldownEnforcementEngine();

  const decision = engine.evaluate({
    nowMs: 2000,
    lock: {
      lockId: 'cooldown-x',
      reason: 'session_blocked',
      startedAtMs: 1000,
      expiresAtMs: 3000,
      durationMs: 2000,
      nonViolable: false,
      operationalGate: 'BLOCKED',
      paperGate: 'BLOCKED',
      liveGate: 'BLOCKED',
      productionMoneyAllowed: false,
      liveMoneyAuthorized: false
    }
  });

  assert.equal(decision.status, 'INVALID');
  assert.equal(decision.blocked, true);
  assert.equal(decision.canStartSession, false);
  assert.ok(decision.reasons.includes('cooldown_must_be_non_violable'));
});

test('rejects live money invariant violations in cooldown lock', () => {
  const engine = new CooldownEnforcementEngine();

  const decision = engine.evaluate({
    nowMs: 2000,
    lock: {
      lockId: 'cooldown-x',
      reason: 'session_blocked',
      startedAtMs: 1000,
      expiresAtMs: 3000,
      durationMs: 2000,
      nonViolable: true,
      operationalGate: 'BLOCKED',
      paperGate: 'BLOCKED',
      liveGate: 'BLOCKED',
      productionMoneyAllowed: true,
      liveMoneyAuthorized: true
    }
  });

  assert.equal(decision.status, 'INVALID');
  assert.ok(decision.reasons.includes('production_money_must_remain_disabled'));
  assert.ok(decision.reasons.includes('live_money_must_remain_disabled'));
  assert.equal(decision.productionMoneyAllowed, false);
  assert.equal(decision.liveMoneyAuthorized, false);
});

test('rejects cooldown duration outside institutional limits', () => {
  const engine = new CooldownEnforcementEngine({
    minDurationMs: 1000,
    defaultDurationMs: 5000,
    maxDurationMs: 10000
  });

  const low = engine.createLock({
    reason: 'session_blocked',
    nowMs: 1000,
    durationMs: 500
  });

  const high = engine.createLock({
    reason: 'session_blocked',
    nowMs: 1000,
    durationMs: 20000
  });

  assert.equal(low.ok, false);
  assert.ok(low.error.reasons.includes('cooldown_duration_below_minimum'));

  assert.equal(high.ok, false);
  assert.ok(high.error.reasons.includes('cooldown_duration_above_maximum'));
});

test('is deterministic and idempotent', () => {
  const engine = new CooldownEnforcementEngine({
    minDurationMs: 1000,
    defaultDurationMs: 5000,
    maxDurationMs: 10000
  });

  const input = {
    reason: 'session_blocked',
    nowMs: 1000,
    durationMs: 5000,
    sessionId: 'abc'
  };

  const first = engine.createLock(input);
  const second = engine.createLock(input);

  assert.deepEqual(first, second);

  const firstDecision = engine.evaluate({ lock: first.value, nowMs: 2000 });
  const secondDecision = engine.evaluate({ lock: first.value, nowMs: 2000 });

  assert.deepEqual(firstDecision, secondDecision);
});

test('validates configuration defensively', () => {
  assert.throws(
    () => new CooldownEnforcementEngine({ minDurationMs: 0 }),
    /minDurationMs/
  );

  assert.throws(
    () => new CooldownEnforcementEngine({
      minDurationMs: 1000,
      defaultDurationMs: 500
    }),
    /defaultDurationMs/
  );

  assert.throws(
    () => new CooldownEnforcementEngine({
      minDurationMs: 1000,
      defaultDurationMs: 5000,
      maxDurationMs: 2000
    }),
    /maxDurationMs/
  );
});
