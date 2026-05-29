import test from 'node:test';
import assert from 'node:assert/strict';

import {
  AdaptiveSupervisionIntelligenceEngine
} from '../dist/domain/memory/adaptive-supervision-intelligence-engine.js';

const engine = new AdaptiveSupervisionIntelligenceEngine();

test('AdaptiveSupervisionIntelligenceEngine applies standard supervision to trusted low-risk contexts', () => {
  const report = engine.evaluate({
    trustState: 'TRUSTED',
    predictionState: 'LOW',
    sessionPatternState: 'STABLE',
    operatorFingerprintState: 'DISCIPLINED',
    trustScore: 92,
    predictedFailureProbability: 10,
    recoveryScore: 75
  });

  assert.equal(report.supervisionMode, 'STANDARD');
  assert.equal(report.canSuggest, true);
  assert.equal(report.requiresCooldown, false);
  assert.equal(report.gate, 'BLOCKED');
  assert.equal(report.liveMoneyAuthorized, false);
});

test('AdaptiveSupervisionIntelligenceEngine applies strict supervision to elevated contexts', () => {
  const report = engine.analyze({
    trustState: 'WATCHLIST',
    predictionState: 'ELEVATED',
    sessionPatternState: 'DEGRADING',
    operatorFingerprintState: 'IMPULSIVE',
    trustScore: 58,
    predictedFailureProbability: 68,
    degradationScore: 60,
    impulsivityScore: 72,
    tiltRiskScore: 50,
    recentVetoes: 1
  });

  assert.equal(report.supervisionMode, 'STRICT');
  assert.equal(report.shouldRestrict, true);
  assert.equal(report.canSuggest, false);
});

test('AdaptiveSupervisionIntelligenceEngine applies protective supervision to high-risk contexts', () => {
  const report = engine.execute({
    trustState: 'RESTRICTED',
    predictionState: 'HIGH',
    sessionPatternState: 'FAILURE_PRONE',
    operatorFingerprintState: 'TILT_PRONE',
    trustScore: 38,
    predictedFailureProbability: 84,
    degradationScore: 78,
    impulsivityScore: 66,
    tiltRiskScore: 76,
    recentCooldowns: 1,
    recentVetoes: 2
  });

  assert.equal(report.supervisionMode, 'PROTECTIVE');
  assert.equal(report.requiresCooldown, true);
  assert.equal(report.shouldRestrict, true);
  assert.equal(report.shouldInterrupt, false);
});

test('AdaptiveSupervisionIntelligenceEngine locks down terminal contexts', () => {
  const report = engine.evaluate({
    trustState: 'LOCKED',
    predictionState: 'CRITICAL',
    sessionPatternState: 'COLLAPSED',
    operatorFingerprintState: 'HIGH_RISK',
    trustScore: 12,
    predictedFailureProbability: 96,
    recentInterruptions: 1
  });

  assert.equal(report.supervisionMode, 'LOCKDOWN');
  assert.equal(report.requiresCooldown, true);
  assert.equal(report.shouldInterrupt, true);
  assert.equal(report.canSuggest, false);
});

test('AdaptiveSupervisionIntelligenceEngine recognizes recovery supervision mode', () => {
  const report = engine.evaluate({
    trustState: 'STABLE',
    predictionState: 'LOW',
    sessionPatternState: 'STABLE',
    operatorFingerprintState: 'RECOVERY_ORIENTED',
    trustScore: 76,
    predictedFailureProbability: 24,
    recoveryScore: 72
  });

  assert.equal(report.supervisionMode, 'RECOVERY');
  assert.equal(report.canSuggest, true);
  assert.ok(report.cooldownMultiplier >= 1);
});

test('AdaptiveSupervisionIntelligenceEngine handles empty input defensively', () => {
  const report = engine.evaluate({});

  assert.equal(report.gate, 'BLOCKED');
  assert.equal(report.operationalGate, 'BLOCKED');
  assert.equal(report.paperSessionGate, 'BLOCKED');
  assert.equal(report.liveSessionGate, 'BLOCKED');
  assert.equal(report.liveMoneyAuthorized, false);
  assert.equal(report.canSuggest, false);
});

test('AdaptiveSupervisionIntelligenceEngine is deterministic and bounded', () => {
  const input = {
    trustState: 'WATCHLIST',
    predictionState: 'WATCH',
    sessionPatternState: 'CAUTION',
    operatorFingerprintState: 'BALANCED',
    trustScore: 66,
    predictedFailureProbability: 44,
    degradationScore: 35,
    recoveryScore: 40
  };

  const first = engine.evaluate(input);
  const second = engine.evaluate(input);

  assert.deepEqual(first, second);
  assert.ok(first.supervisionStrictnessScore >= 0 && first.supervisionStrictnessScore <= 100);
  assert.ok(first.interruptionSensitivity >= 0 && first.interruptionSensitivity <= 100);
});
