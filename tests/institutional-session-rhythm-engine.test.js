import test from 'node:test';
import assert from 'node:assert/strict';

import {
  InstitutionalSessionRhythmEngine
} from '../dist/domain/supervision/institutional-session-rhythm-engine.js';

const engine = new InstitutionalSessionRhythmEngine();

test('InstitutionalSessionRhythmEngine classifies controlled cadence as healthy while keeping gates blocked', () => {
  const report = engine.evaluate({
    sessionId: 'session-healthy',
    spinsObserved: 80,
    averageSecondsBetweenSpins: 33,
    baselineSecondsBetweenSpins: 35,
    lossStreak: 0,
    cooldownViolations: 0,
    manualOverrideAttempts: 0,
    acceptedWarnings: 0,
    rejectedWarnings: 2,
    recoverySignals: 3
  });

  assert.equal(report.state, 'HEALTHY');
  assert.equal(report.gate, 'BLOCKED');
  assert.equal(report.operationalGate, 'BLOCKED');
  assert.equal(report.cooldownRecommendation, 'NOT_REQUIRED');
  assert.ok(report.rhythmScore >= 90);
});

test('InstitutionalSessionRhythmEngine detects accelerated session rhythm', () => {
  const report = engine.evaluate({
    sessionId: 'session-accelerated',
    spinsObserved: 90,
    averageSecondsBetweenSpins: 20,
    baselineSecondsBetweenSpins: 35,
    lossStreak: 1,
    cooldownViolations: 0,
    manualOverrideAttempts: 0,
    acceptedWarnings: 1,
    rejectedWarnings: 0,
    recoverySignals: 1
  });

  assert.equal(report.state, 'ACCELERATED');
  assert.equal(report.requiresCooldown, false);
  assert.ok(report.accelerationPressure >= 30);
});

test('InstitutionalSessionRhythmEngine detects emotional rhythm under loss and acceptance pressure', () => {
  const report = engine.evaluate({
    sessionId: 'session-emotional',
    spinsObserved: 100,
    averageSecondsBetweenSpins: 24,
    baselineSecondsBetweenSpins: 35,
    lossStreak: 4,
    cooldownViolations: 1,
    manualOverrideAttempts: 0,
    acceptedWarnings: 4,
    rejectedWarnings: 0,
    recoverySignals: 1
  });

  assert.equal(report.state, 'EMOTIONAL');
  assert.equal(report.requiresCooldown, false);
  assert.ok(report.emotionalPressure >= 45);
  assert.ok(report.collapsePressure < 86);
});

test('InstitutionalSessionRhythmEngine detects irrational cadence', () => {
  const report = engine.evaluate({
    sessionId: 'session-irrational',
    spinsObserved: 120,
    averageSecondsBetweenSpins: 17,
    baselineSecondsBetweenSpins: 35,
    lossStreak: 5,
    cooldownViolations: 2,
    manualOverrideAttempts: 2,
    acceptedWarnings: 5,
    rejectedWarnings: 0,
    recoverySignals: 1
  });

  assert.equal(report.state, 'IRRATIONAL');
  assert.equal(report.requiresCooldown, true);
  assert.equal(report.cooldownRecommendation, 'REQUIRED');
  assert.ok(report.irrationalPressure >= 68);
});

test('InstitutionalSessionRhythmEngine detects collapsing session when cooldown is violated', () => {
  const report = engine.evaluate({
    sessionId: 'session-collapse',
    spinsObserved: 150,
    averageSecondsBetweenSpins: 12,
    baselineSecondsBetweenSpins: 36,
    lossStreak: 8,
    cooldownViolations: 4,
    manualOverrideAttempts: 4,
    acceptedWarnings: 7,
    rejectedWarnings: 0,
    recoverySignals: 0
  });

  assert.equal(report.state, 'COLLAPSING');
  assert.equal(report.requiresCooldown, true);
  assert.equal(report.recommendation, 'STOP_SESSION');
  assert.ok(report.collapsePressure >= 86);
});

test('InstitutionalSessionRhythmEngine blocks insufficient sample', () => {
  const report = engine.evaluate({
    sessionId: 'session-small-sample',
    spinsObserved: 8,
    averageSecondsBetweenSpins: 10,
    baselineSecondsBetweenSpins: 35,
    lossStreak: 4,
    cooldownViolations: 3,
    manualOverrideAttempts: 3,
    acceptedWarnings: 5,
    rejectedWarnings: 0,
    recoverySignals: 0
  });

  assert.equal(report.state, 'INSUFFICIENT_SAMPLE');
  assert.equal(report.gate, 'BLOCKED');
});

test('InstitutionalSessionRhythmEngine handles invalid unordered input safely as insufficient sample context', () => {
  const report = engine.evaluate({
    sessionId: 'session-invalid-order',
    spinsObserved: 8,
    averageSecondsBetweenSpins: 200,
    baselineSecondsBetweenSpins: 35,
    lossStreak: 4,
    cooldownViolations: 3,
    manualOverrideAttempts: 3,
    acceptedWarnings: 5,
    rejectedWarnings: 0,
    recoverySignals: 0
  });

  assert.equal(report.state, 'INSUFFICIENT_SAMPLE');
});

test('InstitutionalSessionRhythmEngine is deterministic and bounded', () => {
  const input = {
    sessionId: 'session-deterministic',
    spinsObserved: 120,
    averageSecondsBetweenSpins: 19,
    baselineSecondsBetweenSpins: 35,
    lossStreak: 3,
    cooldownViolations: 1,
    manualOverrideAttempts: 1,
    acceptedWarnings: 4,
    rejectedWarnings: 0,
    recoverySignals: 1
  };

  const first = engine.evaluate(input);
  const second = engine.evaluate(input);

  assert.deepEqual(first, second);
  assert.equal(first.score, first.rhythmScore);
  assert.ok(first.rhythmScore >= 0 && first.rhythmScore <= 100);
});

test('InstitutionalSessionRhythmEngine accepts legacy aliases without throwing', () => {
  const report = engine.evaluate({
    sampleSize: '120',
    avgIntervalSeconds: '17',
    expectedIntervalSeconds: '35',
    consecutiveLosses: '5',
    cooldownBreaks: '2',
    overrideAttempts: '2',
    acceptedRiskWarnings: '5'
  });

  assert.equal(report.state, 'IRRATIONAL');
  assert.equal(report.gate, 'BLOCKED');
});
