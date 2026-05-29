import test from 'node:test';
import assert from 'node:assert/strict';

import {
  InstitutionalTrustScoreEngine
} from '../dist/domain/memory/institutional-trust-score-engine.js';

const engine = new InstitutionalTrustScoreEngine();

test('InstitutionalTrustScoreEngine keeps insufficient history unverified and blocked', () => {
  const report = engine.evaluate({
    sessionsObserved: 1,
    disciplineScore: 90,
    resilienceScore: 90
  });

  assert.equal(report.trustState, 'UNVERIFIED');
  assert.equal(report.gate, 'BLOCKED');
  assert.equal(report.operationalGate, 'BLOCKED');
  assert.equal(report.paperSessionGate, 'BLOCKED');
  assert.equal(report.liveSessionGate, 'BLOCKED');
  assert.equal(report.liveMoneyAuthorized, false);
  assert.equal(report.canSuggest, false);
});

test('InstitutionalTrustScoreEngine grants trusted state only under strong compliance', () => {
  const report = engine.evaluate({
    operatorProfileId: 'operator-trusted',
    sessionsObserved: 8,
    disciplineScore: 90,
    resilienceScore: 88,
    cooldownComplianceRate: 96,
    vetoComplianceRate: 95,
    impulsivityScore: 10,
    tiltRiskScore: 12,
    predictedFailureProbability: 8
  });

  assert.equal(report.trustState, 'TRUSTED');
  assert.ok(report.trustScore >= 82);
  assert.equal(report.canSuggest, true);
});

test('InstitutionalTrustScoreEngine places risky but non-terminal operators on watchlist', () => {
  const report = engine.evaluate({
    sessionsObserved: 7,
    disciplineScore: 68,
    resilienceScore: 55,
    cooldownComplianceRate: 80,
    vetoComplianceRate: 78,
    impulsivityScore: 45,
    tiltRiskScore: 70,
    predictedFailureProbability: 64
  });

  assert.equal(report.trustState, 'WATCHLIST');
  assert.equal(report.requiresCooldown, true);
});

test('InstitutionalTrustScoreEngine restricts repeated violations', () => {
  const report = engine.evaluate({
    sessionsObserved: 7,
    disciplineScore: 65,
    resilienceScore: 58,
    cooldownComplianceRate: 72,
    vetoComplianceRate: 70,
    impulsivityScore: 58,
    tiltRiskScore: 55,
    predictedFailureProbability: 58,
    cooldownViolations: 1,
    manualOverrides: 1
  });

  assert.equal(report.trustState, 'RESTRICTED');
  assert.equal(report.shouldRestrict, true);
});

test('InstitutionalTrustScoreEngine locks terminal or repeated veto violation operators', () => {
  const report = engine.execute({
    sessionsObserved: 7,
    disciplineScore: 50,
    resilienceScore: 40,
    cooldownComplianceRate: 50,
    vetoComplianceRate: 45,
    impulsivityScore: 80,
    tiltRiskScore: 82,
    predictedFailureProbability: 90,
    vetoViolations: 2
  });

  assert.equal(report.trustState, 'LOCKED');
  assert.equal(report.shouldLock, true);
  assert.equal(report.canSuggest, false);
});

test('InstitutionalTrustScoreEngine is deterministic and bounded', () => {
  const input = {
    sessionsObserved: 10,
    disciplineScore: 75,
    resilienceScore: 70,
    cooldownComplianceRate: 88,
    vetoComplianceRate: 85,
    impulsivityScore: 25,
    tiltRiskScore: 30,
    predictedFailureProbability: 22,
    recoverySessions: 3
  };

  const first = engine.evaluate(input);
  const second = engine.evaluate(input);

  assert.deepEqual(first, second);
  assert.ok(first.trustScore >= 0 && first.trustScore <= 100);
  assert.ok(first.trustSeedScore >= 0 && first.trustSeedScore <= 100);
  assert.ok(first.complianceScore >= 0 && first.complianceScore <= 100);
  assert.ok(first.penaltyScore >= 0 && first.penaltyScore <= 100);
});
