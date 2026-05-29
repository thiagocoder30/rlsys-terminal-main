import test from 'node:test';
import assert from 'node:assert/strict';

import {
  OperatorBehavioralFingerprintEngine
} from '../dist/domain/memory/operator-behavioral-fingerprint-engine.js';

const engine = new OperatorBehavioralFingerprintEngine();

test('OperatorBehavioralFingerprintEngine returns insufficient data for small samples while gates stay blocked', () => {
  const report = engine.evaluate({
    events: [
      { eventId: 'e1', timestamp: 1, type: 'WIN' },
      { eventId: 'e2', timestamp: 2, type: 'LOSS' }
    ]
  });

  assert.equal(report.fingerprintState, 'INSUFFICIENT_DATA');
  assert.equal(report.gate, 'BLOCKED');
  assert.equal(report.operationalGate, 'BLOCKED');
  assert.equal(report.paperSessionGate, 'BLOCKED');
  assert.equal(report.liveSessionGate, 'BLOCKED');
  assert.equal(report.liveMoneyAuthorized, false);
});

test('OperatorBehavioralFingerprintEngine detects disciplined behavior', () => {
  const report = engine.evaluate({
    events: [
      { eventId: 'e1', timestamp: 1, type: 'COOLDOWN_RESPECTED' },
      { eventId: 'e2', timestamp: 2, type: 'VETO_ACCEPTED' },
      { eventId: 'e3', timestamp: 3, type: 'WIN' },
      { eventId: 'e4', timestamp: 4, type: 'COOLDOWN_RESPECTED' },
      { eventId: 'e5', timestamp: 5, type: 'VETO_ACCEPTED' },
      { eventId: 'e6', timestamp: 6, type: 'WIN' }
    ]
  });

  assert.equal(report.fingerprintState, 'DISCIPLINED');
  assert.ok(report.disciplineScore >= 65);
});

test('OperatorBehavioralFingerprintEngine detects impulsive behavior without over-escalating to high risk', () => {
  const report = engine.analyze({
    events: [
      { eventId: 'e1', timestamp: 1, type: 'COOLDOWN_VIOLATED', riskPressure: 68 },
      { eventId: 'e2', timestamp: 2, type: 'VETO_IGNORED', riskPressure: 72 },
      { eventId: 'e3', timestamp: 3, type: 'MANUAL_OVERRIDE', riskPressure: 74 },
      { eventId: 'e4', timestamp: 4, type: 'WARNING_ACCEPTED', riskPressure: 76 },
      { eventId: 'e5', timestamp: 5, type: 'LOSS', riskPressure: 78 },
      { eventId: 'e6', timestamp: 6, type: 'LOSS', riskPressure: 80 }
    ]
  });

  assert.equal(report.fingerprintState, 'IMPULSIVE');
  assert.ok(report.impulsivityScore >= 60);
});

test('OperatorBehavioralFingerprintEngine detects recovery-oriented behavior', () => {
  const report = engine.evaluate({
    events: [
      { eventId: 'e1', timestamp: 1, type: 'LOSS' },
      { eventId: 'e2', timestamp: 2, type: 'RECOVERY_SIGNAL' },
      { eventId: 'e3', timestamp: 3, type: 'COOLDOWN_RESPECTED' },
      { eventId: 'e4', timestamp: 4, type: 'VETO_ACCEPTED' },
      { eventId: 'e5', timestamp: 5, type: 'RECOVERY_SIGNAL' },
      { eventId: 'e6', timestamp: 6, type: 'WIN' }
    ]
  });

  assert.equal(report.fingerprintState, 'RECOVERY_ORIENTED');
  assert.ok(report.resilienceScore >= 60);
});

test('OperatorBehavioralFingerprintEngine detects high risk behavior', () => {
  const report = engine.execute({
    events: [
      { eventId: 'e1', timestamp: 1, type: 'LOSS', riskPressure: 84 },
      { eventId: 'e2', timestamp: 2, type: 'LOSS', riskPressure: 86 },
      { eventId: 'e3', timestamp: 3, type: 'COOLDOWN_VIOLATED', riskPressure: 88 },
      { eventId: 'e4', timestamp: 4, type: 'VETO_IGNORED', riskPressure: 90 },
      { eventId: 'e5', timestamp: 5, type: 'MANUAL_OVERRIDE', riskPressure: 92 },
      { eventId: 'e6', timestamp: 6, type: 'SESSION_INTERRUPTED', riskPressure: 96 }
    ]
  });

  assert.equal(report.fingerprintState, 'HIGH_RISK');
  assert.equal(report.counters.interruptions, 1);
});

test('OperatorBehavioralFingerprintEngine is deterministic and bounded', () => {
  const input = {
    events: [
      { eventId: 'e1', timestamp: 1, type: 'WIN', riskPressure: 10 },
      { eventId: 'e2', timestamp: 2, type: 'LOSS', riskPressure: 20 },
      { eventId: 'e3', timestamp: 3, type: 'RECOVERY_SIGNAL', riskPressure: 12 },
      { eventId: 'e4', timestamp: 4, type: 'COOLDOWN_RESPECTED', riskPressure: 8 },
      { eventId: 'e5', timestamp: 5, type: 'VETO_ACCEPTED', riskPressure: 7 },
      { eventId: 'e6', timestamp: 6, type: 'WIN', riskPressure: 6 }
    ]
  };

  const first = engine.evaluate(input);
  const second = engine.evaluate(input);

  assert.deepEqual(first, second);
  assert.ok(first.disciplineScore >= 0 && first.disciplineScore <= 100);
  assert.ok(first.impulsivityScore >= 0 && first.impulsivityScore <= 100);
  assert.ok(first.resilienceScore >= 0 && first.resilienceScore <= 100);
  assert.ok(first.tiltRiskScore >= 0 && first.tiltRiskScore <= 100);
  assert.ok(first.trustSeedScore >= 0 && first.trustSeedScore <= 100);
});

test('OperatorBehavioralFingerprintEngine rejects malformed events without silent failure', () => {
  assert.throws(
    () => engine.evaluate({
      events: [
        { eventId: '', timestamp: 1, type: 'WIN' }
      ]
    }),
    /INVALID_OPERATOR_BEHAVIORAL_FINGERPRINT_EVENT_ID/
  );
});
