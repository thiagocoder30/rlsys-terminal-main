'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { InstitutionalAuthorizationEngine } = require('../../../src/domain/authorization/InstitutionalAuthorizationEngine');

function approvedWarmupQualification() {
  return {
    status: 'APPROVED',
    approved: true,
    qualificationScore: 0.91,
    operationalGate: 'BLOCKED',
    paperGate: 'BLOCKED',
    liveGate: 'BLOCKED',
    productionMoneyAllowed: false,
    liveMoneyAuthorized: false
  };
}

test('authorizes PAPER session when table, operator, trust and risk are valid', () => {
  const engine = new InstitutionalAuthorizationEngine();

  const decision = engine.authorize({
    warmupQualification: approvedWarmupQualification(),
    tableContextScore: 0.86,
    operatorReadinessScore: 0.88,
    supervisionRiskScore: 0.18,
    operatorTrustScore: 0.81
  });

  assert.equal(decision.status, 'PAPER_SESSION_AUTHORIZED');
  assert.equal(decision.paperSessionAuthorized, true);
  assert.equal(decision.operationalGate, 'PAPER_AUTHORIZED');
  assert.equal(decision.paperGate, 'PAPER_AUTHORIZED');
  assert.equal(decision.liveGate, 'BLOCKED');
  assert.equal(decision.productionMoneyAllowed, false);
  assert.equal(decision.liveMoneyAuthorized, false);
  assert.deepEqual(decision.reasons, []);
});

test('blocks session when warmup was not approved', () => {
  const engine = new InstitutionalAuthorizationEngine();

  const decision = engine.authorize({
    warmupQualification: {
      ...approvedWarmupQualification(),
      status: 'REJECTED',
      approved: false
    },
    tableContextScore: 0.9,
    operatorReadinessScore: 0.9,
    supervisionRiskScore: 0.1,
    operatorTrustScore: 0.9
  });

  assert.equal(decision.status, 'SESSION_BLOCKED');
  assert.equal(decision.paperSessionAuthorized, false);
  assert.ok(decision.reasons.includes('warmup_not_approved'));
  assert.equal(decision.paperGate, 'BLOCKED');
});

test('blocks session when table context is weak', () => {
  const engine = new InstitutionalAuthorizationEngine();

  const decision = engine.authorize({
    warmupQualification: approvedWarmupQualification(),
    tableContextScore: 0.4,
    operatorReadinessScore: 0.9,
    supervisionRiskScore: 0.1,
    operatorTrustScore: 0.9
  });

  assert.equal(decision.status, 'SESSION_BLOCKED');
  assert.ok(decision.reasons.includes('table_context_below_minimum'));
});

test('blocks session when operator is not ready', () => {
  const engine = new InstitutionalAuthorizationEngine();

  const decision = engine.authorize({
    warmupQualification: approvedWarmupQualification(),
    tableContextScore: 0.9,
    operatorReadinessScore: 0.5,
    supervisionRiskScore: 0.1,
    operatorTrustScore: 0.9
  });

  assert.equal(decision.status, 'SESSION_BLOCKED');
  assert.ok(decision.reasons.includes('operator_readiness_below_minimum'));
});

test('blocks session when supervision risk is high', () => {
  const engine = new InstitutionalAuthorizationEngine();

  const decision = engine.authorize({
    warmupQualification: approvedWarmupQualification(),
    tableContextScore: 0.9,
    operatorReadinessScore: 0.9,
    supervisionRiskScore: 0.8,
    operatorTrustScore: 0.9
  });

  assert.equal(decision.status, 'SESSION_BLOCKED');
  assert.ok(decision.reasons.includes('supervision_risk_above_limit'));
});

test('blocks session when cooldown is active', () => {
  const engine = new InstitutionalAuthorizationEngine();

  const decision = engine.authorize({
    warmupQualification: approvedWarmupQualification(),
    tableContextScore: 0.95,
    operatorReadinessScore: 0.95,
    supervisionRiskScore: 0.05,
    operatorTrustScore: 0.95,
    cooldownActive: true
  });

  assert.equal(decision.status, 'SESSION_BLOCKED');
  assert.ok(decision.reasons.includes('cooldown_active'));
  assert.equal(decision.paperGate, 'BLOCKED');
});

test('blocks session when veto is active', () => {
  const engine = new InstitutionalAuthorizationEngine();

  const decision = engine.authorize({
    warmupQualification: approvedWarmupQualification(),
    tableContextScore: 0.95,
    operatorReadinessScore: 0.95,
    supervisionRiskScore: 0.05,
    operatorTrustScore: 0.95,
    vetoActive: true
  });

  assert.equal(decision.status, 'SESSION_BLOCKED');
  assert.ok(decision.reasons.includes('veto_active'));
});

test('never propagates live money authorization even if upstream invariant is violated', () => {
  const engine = new InstitutionalAuthorizationEngine();

  const decision = engine.authorize({
    warmupQualification: {
      ...approvedWarmupQualification(),
      liveMoneyAuthorized: true,
      productionMoneyAllowed: true
    },
    tableContextScore: 0.95,
    operatorReadinessScore: 0.95,
    supervisionRiskScore: 0.05,
    operatorTrustScore: 0.95
  });

  assert.equal(decision.status, 'SESSION_BLOCKED');
  assert.equal(decision.productionMoneyAllowed, false);
  assert.equal(decision.liveMoneyAuthorized, false);
  assert.equal(decision.liveGate, 'BLOCKED');
  assert.ok(decision.reasons.includes('warmup_production_money_invariant_violation'));
  assert.ok(decision.reasons.includes('warmup_live_money_invariant_violation'));
});

test('is deterministic and idempotent', () => {
  const engine = new InstitutionalAuthorizationEngine();
  const input = {
    warmupQualification: approvedWarmupQualification(),
    tableContextScore: 0.86,
    operatorReadinessScore: 0.88,
    supervisionRiskScore: 0.18,
    operatorTrustScore: 0.81
  };

  const first = engine.authorize(input);
  const second = engine.authorize(input);

  assert.deepEqual(first, second);
});

test('rejects invalid config defensively', () => {
  assert.throws(
    () => new InstitutionalAuthorizationEngine({ minAuthorizationScore: 2 }),
    /minAuthorizationScore/
  );

  assert.throws(
    () => new InstitutionalAuthorizationEngine({ maxSupervisionRiskScore: -1 }),
    /maxSupervisionRiskScore/
  );
});
