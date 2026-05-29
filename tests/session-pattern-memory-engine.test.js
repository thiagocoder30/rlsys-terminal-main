import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SessionPatternMemoryEngine
} from '../dist/domain/memory/session-pattern-memory-engine.js';

const engine = new SessionPatternMemoryEngine();

test('SessionPatternMemoryEngine returns insufficient data for small samples while gates stay blocked', () => {
  const report = engine.analyze({
    sessionId: 'small-memory',
    events: [
      { eventId: 'e1', timestamp: 1, type: 'LOSS' },
      { eventId: 'e2', timestamp: 2, type: 'WIN' }
    ]
  });

  assert.equal(report.patternState, 'INSUFFICIENT_DATA');
  assert.equal(report.gate, 'BLOCKED');
  assert.equal(report.operationalGate, 'BLOCKED');
  assert.equal(report.paperSessionGate, 'BLOCKED');
  assert.equal(report.liveSessionGate, 'BLOCKED');
  assert.equal(report.liveMoneyAuthorized, false);
});

test('SessionPatternMemoryEngine classifies stable disciplined sessions', () => {
  const report = engine.analyze({
    events: [
      { eventId: 'e1', timestamp: 1, type: 'WIN', riskPressure: 12 },
      { eventId: 'e2', timestamp: 2, type: 'WIN', riskPressure: 10 },
      { eventId: 'e3', timestamp: 3, type: 'ASSISTED_SUGGESTION', riskPressure: 16 },
      { eventId: 'e4', timestamp: 4, type: 'WIN', riskPressure: 11 },
      { eventId: 'e5', timestamp: 5, type: 'RECOVERY_SIGNAL', riskPressure: 8 }
    ]
  });

  assert.equal(report.patternState, 'STABLE');
  assert.equal(report.counters.wins, 3);
  assert.ok(report.recoveryScore > 0);
});

test('SessionPatternMemoryEngine detects caution patterns', () => {
  const report = engine.analyze({
    events: [
      { eventId: 'e1', timestamp: 1, type: 'LOSS' },
      { eventId: 'e2', timestamp: 2, type: 'LOSS' },
      { eventId: 'e3', timestamp: 3, type: 'WARNING_ACCEPTED' },
      { eventId: 'e4', timestamp: 4, type: 'WIN' },
      { eventId: 'e5', timestamp: 5, type: 'RECOVERY_SIGNAL' }
    ]
  });

  assert.equal(report.patternState, 'CAUTION');
  assert.ok(report.reasons.includes('LOSS_STREAK_PATTERN_DETECTED'));
});

test('SessionPatternMemoryEngine detects degrading patterns', () => {
  const report = engine.evaluate({
    events: [
      { eventId: 'e1', timestamp: 1, type: 'LOSS', riskPressure: 50 },
      { eventId: 'e2', timestamp: 2, type: 'LOSS', riskPressure: 55 },
      { eventId: 'e3', timestamp: 3, type: 'SUPERVISOR_VETO', riskPressure: 72 },
      { eventId: 'e4', timestamp: 4, type: 'RHYTHM_ACCELERATION', riskPressure: 70 },
      { eventId: 'e5', timestamp: 5, type: 'WARNING_ACCEPTED', riskPressure: 74 }
    ]
  });

  assert.equal(report.patternState, 'DEGRADING');
  assert.ok(report.degradationScore >= 45);
});

test('SessionPatternMemoryEngine detects failure-prone compounded patterns', () => {
  const report = engine.analyze({
    events: [
      { eventId: 'e1', timestamp: 1, type: 'LOSS', riskPressure: 82 },
      { eventId: 'e2', timestamp: 2, type: 'LOSS', riskPressure: 84 },
      { eventId: 'e3', timestamp: 3, type: 'SUPERVISOR_VETO', riskPressure: 86 },
      { eventId: 'e4', timestamp: 4, type: 'COOLDOWN_TRIGGERED', riskPressure: 88 },
      { eventId: 'e5', timestamp: 5, type: 'OPERATOR_TILT', riskPressure: 90 }
    ]
  });

  assert.equal(report.patternState, 'FAILURE_PRONE');
  assert.ok(report.reasons.includes('CONTEXTUAL_FAILURE_RISK_PATTERN_DETECTED'));
});

test('SessionPatternMemoryEngine detects collapsed patterns from terminal interruption', () => {
  const report = engine.execute({
    events: [
      { eventId: 'e1', timestamp: 1, type: 'LOSS', riskPressure: 80 },
      { eventId: 'e2', timestamp: 2, type: 'COOLDOWN_TRIGGERED', riskPressure: 85 },
      { eventId: 'e3', timestamp: 3, type: 'SESSION_INTERRUPTED', riskPressure: 96 },
      { eventId: 'e4', timestamp: 4, type: 'SUPERVISOR_VETO', riskPressure: 90 },
      { eventId: 'e5', timestamp: 5, type: 'OPERATOR_TILT', riskPressure: 92 }
    ]
  });

  assert.equal(report.patternState, 'COLLAPSED');
  assert.equal(report.counters.interruptions, 1);
});

test('SessionPatternMemoryEngine is deterministic and bounded', () => {
  const input = {
    events: [
      { eventId: 'e1', timestamp: 1, type: 'WIN', riskPressure: 10 },
      { eventId: 'e2', timestamp: 2, type: 'LOSS', riskPressure: 20 },
      { eventId: 'e3', timestamp: 3, type: 'RECOVERY_SIGNAL', riskPressure: 12 },
      { eventId: 'e4', timestamp: 4, type: 'WIN', riskPressure: 8 },
      { eventId: 'e5', timestamp: 5, type: 'WIN', riskPressure: 6 }
    ]
  };

  const first = engine.analyze(input);
  const second = engine.analyze(input);

  assert.deepEqual(first, second);
  assert.ok(first.degradationScore >= 0 && first.degradationScore <= 100);
  assert.ok(first.failureRiskScore >= 0 && first.failureRiskScore <= 100);
  assert.ok(first.memoryIntegrityScore >= 0 && first.memoryIntegrityScore <= 100);
});

test('SessionPatternMemoryEngine rejects malformed events without silent failure', () => {
  assert.throws(
    () => engine.analyze({
      events: [
        { eventId: '', timestamp: 1, type: 'WIN' }
      ]
    }),
    /INVALID_SESSION_PATTERN_MEMORY_EVENT_ID/
  );
});
