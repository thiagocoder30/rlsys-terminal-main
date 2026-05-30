'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { InstitutionalAuthorizationEngine } = require('../../../src/domain/authorization/InstitutionalAuthorizationEngine');
const { AuthorizationExplainabilityEngine } = require('../../../src/domain/authorization/AuthorizationExplainabilityEngine');

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

test('explains authorized PAPER session while keeping live money blocked', () => {
  const authorization = new InstitutionalAuthorizationEngine();
  const explainability = new AuthorizationExplainabilityEngine();

  const decision = authorization.authorize({
    warmupQualification: approvedWarmupQualification(),
    tableContextScore: 0.9,
    operatorReadinessScore: 0.9,
    supervisionRiskScore: 0.1,
    operatorTrustScore: 0.9
  });

  const explanation = explainability.explain({ authorizationDecision: decision });

  assert.equal(explanation.ok, true);
  assert.equal(explanation.value.status, 'PAPER_SESSION_AUTHORIZED');
  assert.equal(explanation.value.severity, 'INFO');
  assert.equal(explanation.value.paperGate, 'PAPER_AUTHORIZED');
  assert.equal(explanation.value.liveGate, 'BLOCKED');
  assert.equal(explanation.value.productionMoneyAllowed, false);
  assert.equal(explanation.value.liveMoneyAuthorized, false);
  assert.ok(explanation.value.summary.includes('PAPER session authorized'));
});

test('explains blocked session with critical cooldown reason', () => {
  const explainability = new AuthorizationExplainabilityEngine();

  const explanation = explainability.explain({
    authorizationDecision: {
      status: 'SESSION_BLOCKED',
      paperSessionAuthorized: false,
      authorizationScore: 0.8,
      reasons: ['cooldown_active'],
      tableComponent: 0.9,
      operatorComponent: 0.9,
      trustComponent: 0.9,
      riskComponent: 0.9,
      operationalGate: 'BLOCKED',
      paperGate: 'BLOCKED',
      liveGate: 'BLOCKED',
      productionMoneyAllowed: false,
      liveMoneyAuthorized: false
    },
    cooldownDecision: {
      status: 'ACTIVE'
    },
    waitingTimeDecision: {
      severity: 'HIGH',
      durationMinutes: 45
    }
  });

  assert.equal(explanation.ok, true);
  assert.equal(explanation.value.status, 'SESSION_BLOCKED');
  assert.equal(explanation.value.severity, 'CRITICAL');
  assert.ok(explanation.value.recommendedActions.includes('Respect the active cooldown until expiration.'));
  assert.ok(explanation.value.recommendedActions.includes('Minimum waiting time: 45 minutes.'));
});

test('explains weak table context with operator action', () => {
  const explainability = new AuthorizationExplainabilityEngine();

  const explanation = explainability.explain({
    authorizationDecision: {
      status: 'SESSION_BLOCKED',
      paperSessionAuthorized: false,
      authorizationScore: 0.62,
      reasons: ['table_context_below_minimum'],
      tableComponent: 0.4,
      operatorComponent: 0.9,
      trustComponent: 0.9,
      riskComponent: 0.9,
      operationalGate: 'BLOCKED',
      paperGate: 'BLOCKED',
      liveGate: 'BLOCKED',
      productionMoneyAllowed: false,
      liveMoneyAuthorized: false
    }
  });

  assert.equal(explanation.ok, true);
  assert.equal(explanation.value.severity, 'WARNING');
  assert.ok(explanation.value.recommendedActions.includes('Wait for a new warm-up sample from the table.'));
});

test('does not authorize paper when live money invariant is violated upstream', () => {
  const explainability = new AuthorizationExplainabilityEngine();

  const explanation = explainability.explain({
    authorizationDecision: {
      status: 'PAPER_SESSION_AUTHORIZED',
      paperSessionAuthorized: true,
      authorizationScore: 0.95,
      reasons: [],
      tableComponent: 0.9,
      operatorComponent: 0.9,
      trustComponent: 0.9,
      riskComponent: 0.9,
      operationalGate: 'PAPER_AUTHORIZED',
      paperGate: 'PAPER_AUTHORIZED',
      liveGate: 'OPEN',
      productionMoneyAllowed: true,
      liveMoneyAuthorized: true
    }
  });

  assert.equal(explanation.ok, true);
  assert.equal(explanation.value.status, 'SESSION_BLOCKED');
  assert.equal(explanation.value.paperSessionAuthorized, false);
  assert.equal(explanation.value.paperGate, 'BLOCKED');
  assert.equal(explanation.value.liveGate, 'BLOCKED');
  assert.equal(explanation.value.productionMoneyAllowed, false);
  assert.equal(explanation.value.liveMoneyAuthorized, false);
});

test('is deterministic and idempotent', () => {
  const explainability = new AuthorizationExplainabilityEngine();
  const input = {
    authorizationDecision: {
      status: 'SESSION_BLOCKED',
      paperSessionAuthorized: false,
      authorizationScore: 0.55,
      reasons: ['operator_readiness_below_minimum'],
      tableComponent: 0.9,
      operatorComponent: 0.4,
      trustComponent: 0.9,
      riskComponent: 0.9,
      operationalGate: 'BLOCKED',
      paperGate: 'BLOCKED',
      liveGate: 'BLOCKED',
      productionMoneyAllowed: false,
      liveMoneyAuthorized: false
    }
  };

  const first = explainability.explain(input);
  const second = explainability.explain(input);

  assert.deepEqual(first, second);
});

test('rejects invalid input safely', () => {
  const explainability = new AuthorizationExplainabilityEngine();

  const result = explainability.explain(null);

  assert.equal(result.ok, false);
  assert.ok(result.error.reasons.includes('input_not_object'));
});

test('validates configuration defensively', () => {
  assert.throws(
    () => new AuthorizationExplainabilityEngine({ criticalScoreThreshold: -1 }),
    /criticalScoreThreshold/
  );

  assert.throws(
    () => new AuthorizationExplainabilityEngine({
      criticalScoreThreshold: 0.8,
      warningScoreThreshold: 0.7
    }),
    /warningScoreThreshold/
  );
});
