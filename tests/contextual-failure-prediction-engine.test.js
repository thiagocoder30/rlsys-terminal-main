import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ContextualFailurePredictionEngine
} from '../dist/domain/memory/contextual-failure-prediction-engine.js';

const engine = new ContextualFailurePredictionEngine();

test('ContextualFailurePredictionEngine keeps low-risk contexts observable and gates blocked', () => {
  const report = engine.predict({
    sessionPatternState: 'STABLE',
    operatorFingerprintState: 'DISCIPLINED',
    sessionRhythmState: 'HEALTHY',
    antiChasingState: 'CLEAR',
    trustSeedScore: 92,
    recoveryScore: 80,
    contextualRiskPressure: 12
  });

  assert.equal(report.predictionState, 'LOW');
  assert.equal(report.recommendation, 'OBSERVE_ONLY');
  assert.equal(report.canSuggest, true);
  assert.equal(report.gate, 'BLOCKED');
  assert.equal(report.operationalGate, 'BLOCKED');
  assert.equal(report.paperSessionGate, 'BLOCKED');
  assert.equal(report.liveSessionGate, 'BLOCKED');
  assert.equal(report.liveMoneyAuthorized, false);
});

test('ContextualFailurePredictionEngine escalates caution contexts to watch', () => {
  const report = engine.evaluate({
    sessionPatternState: 'CAUTION',
    operatorFingerprintState: 'BALANCED',
    sessionRhythmState: 'ACCELERATED',
    antiChasingState: 'WATCH',
    degradationScore: 35,
    failureRiskScore: 32,
    trustSeedScore: 70,
    recoveryScore: 45,
    recentLossStreak: 2
  });

  assert.equal(report.predictionState, 'WATCH');
  assert.equal(report.recommendation, 'INCREASE_SUPERVISION');
  assert.equal(report.requiresCooldown, false);
});

test('ContextualFailurePredictionEngine detects elevated failure probability without premature high escalation', () => {
  const report = engine.predict({
    sessionPatternState: 'DEGRADING',
    operatorFingerprintState: 'IMPULSIVE',
    sessionRhythmState: 'EMOTIONAL',
    antiChasingState: 'RISK',
    degradationScore: 62,
    failureRiskScore: 58,
    impulsivityScore: 72,
    tiltRiskScore: 50,
    trustSeedScore: 44,
    contextualRiskPressure: 66,
    recentLossStreak: 3,
    recentSupervisorVetoes: 1
  });

  assert.equal(report.predictionState, 'ELEVATED');
  assert.equal(report.recommendation, 'VETO_OPERATION');
  assert.equal(report.canSuggest, false);
});

test('ContextualFailurePredictionEngine detects high-risk failure-prone contexts', () => {
  const report = engine.execute({
    sessionPatternState: 'FAILURE_PRONE',
    operatorFingerprintState: 'TILT_PRONE',
    sessionRhythmState: 'IRRATIONAL',
    antiChasingState: 'RISK',
    degradationScore: 78,
    failureRiskScore: 82,
    impulsivityScore: 70,
    tiltRiskScore: 76,
    trustSeedScore: 28,
    contextualRiskPressure: 84,
    recentLossStreak: 4,
    recentSupervisorVetoes: 2,
    recentCooldowns: 1
  });

  assert.equal(report.predictionState, 'HIGH');
  assert.equal(report.recommendation, 'COOLDOWN_REQUIRED');
  assert.equal(report.requiresCooldown, true);
});

test('ContextualFailurePredictionEngine interrupts terminal contexts', () => {
  const report = engine.predict({
    sessionPatternState: 'COLLAPSED',
    operatorFingerprintState: 'HIGH_RISK',
    sessionRhythmState: 'COLLAPSING',
    antiChasingState: 'CHASING',
    failureRiskScore: 95,
    contextualRiskPressure: 96
  });

  assert.equal(report.predictionState, 'CRITICAL');
  assert.equal(report.recommendation, 'INTERRUPT_SESSION');
  assert.equal(report.shouldInterrupt, true);
  assert.equal(report.requiresCooldown, true);
});

test('ContextualFailurePredictionEngine is deterministic and bounded', () => {
  const input = {
    sessionPatternState: 'DEGRADING',
    operatorFingerprintState: 'IMPULSIVE',
    sessionRhythmState: 'EMOTIONAL',
    antiChasingState: 'RISK',
    degradationScore: 55,
    failureRiskScore: 60,
    impulsivityScore: 65,
    tiltRiskScore: 55,
    trustSeedScore: 50,
    contextualRiskPressure: 62,
    recoveryScore: 20,
    recentLossStreak: 3
  };

  const first = engine.predict(input);
  const second = engine.predict(input);

  assert.deepEqual(first, second);
  assert.ok(first.predictedFailureProbability >= 0 && first.predictedFailureProbability <= 100);
  assert.ok(first.earlyWarningScore >= 0 && first.earlyWarningScore <= 100);
  assert.ok(first.compoundedRiskScore >= 0 && first.compoundedRiskScore <= 100);
  assert.ok(first.recoveryBufferScore >= 0 && first.recoveryBufferScore <= 100);
});

test('ContextualFailurePredictionEngine handles empty input defensively without opening gates', () => {
  const report = engine.predict({});

  assert.equal(report.gate, 'BLOCKED');
  assert.equal(report.operationalGate, 'BLOCKED');
  assert.equal(report.paperSessionGate, 'BLOCKED');
  assert.equal(report.liveSessionGate, 'BLOCKED');
  assert.equal(report.liveMoneyAuthorized, false);
  assert.equal(report.canSuggest, false);
});
