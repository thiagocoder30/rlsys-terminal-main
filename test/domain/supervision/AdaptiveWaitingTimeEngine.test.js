'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { AdaptiveWaitingTimeEngine } = require('../../../src/domain/supervision/AdaptiveWaitingTimeEngine');

test('calculates low waiting time for low severity block', () => {
  const engine = new AdaptiveWaitingTimeEngine();

  const result = engine.calculate({
    supervisionRiskScore: 0.2,
    operatorInstabilityScore: 0.1,
    tableInstabilityScore: 0.1
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.severity, 'LOW');
  assert.equal(result.value.durationMinutes, 15);
  assert.equal(result.value.nonViolable, true);
  assert.equal(result.value.paperGate, 'BLOCKED');
  assert.equal(result.value.liveGate, 'BLOCKED');
  assert.equal(result.value.productionMoneyAllowed, false);
  assert.equal(result.value.liveMoneyAuthorized, false);
});

test('calculates moderate waiting time for moderate severity', () => {
  const engine = new AdaptiveWaitingTimeEngine();

  const result = engine.calculate({
    supervisionRiskScore: 0.7,
    operatorInstabilityScore: 0.2,
    tableInstabilityScore: 0.2
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.severity, 'MODERATE');
  assert.equal(result.value.durationMinutes, 30);
});

test('calculates high waiting time when instability is elevated', () => {
  const engine = new AdaptiveWaitingTimeEngine();

  const result = engine.calculate({
    supervisionRiskScore: 0.8,
    operatorInstabilityScore: 0.8,
    tableInstabilityScore: 0.6,
    recentBlockCount: 1
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.severity, 'HIGH');
  assert.equal(result.value.durationMinutes, 50);
  assert.ok(result.value.reasons.includes('recent_blocks_present'));
});

test('calculates critical waiting time when veto, chasing and tilt are present', () => {
  const engine = new AdaptiveWaitingTimeEngine();

  const result = engine.calculate({
    supervisionRiskScore: 0.95,
    operatorInstabilityScore: 0.8,
    tableInstabilityScore: 0.7,
    vetoActive: true,
    chasingDetected: true,
    tiltDetected: true
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.severity, 'CRITICAL');
  assert.equal(result.value.durationMinutes, 60);
  assert.ok(result.value.reasons.includes('veto_active'));
  assert.ok(result.value.reasons.includes('chasing_detected'));
  assert.ok(result.value.reasons.includes('tilt_detected'));
});

test('caps recurrence penalty at institutional maximum', () => {
  const engine = new AdaptiveWaitingTimeEngine({
    minDurationMs: 60000,
    lowDurationMs: 60000,
    moderateDurationMs: 120000,
    highDurationMs: 180000,
    criticalDurationMs: 240000,
    maxDurationMs: 300000
  });

  const result = engine.calculate({
    supervisionRiskScore: 1,
    operatorInstabilityScore: 1,
    tableInstabilityScore: 1,
    recentBlockCount: 99,
    vetoActive: true
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.durationMs, 300000);
});

test('rejects invalid required supervision risk score', () => {
  const engine = new AdaptiveWaitingTimeEngine();

  const result = engine.calculate({
    supervisionRiskScore: 2
  });

  assert.equal(result.ok, false);
  assert.ok(result.error.reasons.includes('invalid_supervision_risk_score'));
});

test('is deterministic and idempotent', () => {
  const engine = new AdaptiveWaitingTimeEngine();
  const input = {
    supervisionRiskScore: 0.9,
    operatorInstabilityScore: 0.7,
    tableInstabilityScore: 0.6,
    recentBlockCount: 2,
    vetoActive: true
  };

  const first = engine.calculate(input);
  const second = engine.calculate(input);

  assert.deepEqual(first, second);
});

test('validates configuration defensively', () => {
  assert.throws(
    () => new AdaptiveWaitingTimeEngine({ minDurationMs: 0 }),
    /minDurationMs/
  );

  assert.throws(
    () => new AdaptiveWaitingTimeEngine({
      minDurationMs: 1000,
      lowDurationMs: 500
    }),
    /lowDurationMs/
  );

  assert.throws(
    () => new AdaptiveWaitingTimeEngine({
      minDurationMs: 1000,
      lowDurationMs: 1000,
      moderateDurationMs: 2000,
      highDurationMs: 3000,
      criticalDurationMs: 4000,
      maxDurationMs: 3500
    }),
    /maxDurationMs/
  );
});
