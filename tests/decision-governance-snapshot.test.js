const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DecisionGovernanceSnapshotBuilder
} = require('../dist/application/decision/DecisionGovernanceSnapshot');


test('DecisionGovernanceSnapshot consolidates governance evidence', () => {


  const builder =
    new DecisionGovernanceSnapshotBuilder();



  const trace = {

    decisionId:
      'decision-001',

    sessionId:
      'session-001',

    engineVersion:
      'strategy-decision-v1',

    schemaVersion:
      '2.9.0',

    action:
      'BLOCKED',

    operationalGate:
      'NO_GO',

    allowed:
      false,

    confidenceScore:
      0.2,

    riskScore:
      0.9,

    blockers:
      [
        'NO_GO'
      ],

    warnings:
      [],

    generatedAt:
      new Date().toISOString()

  };



  const explanation = {

    decisionId:
      'decision-001',

    decision:
      'BLOCKED',

    operationalGate:
      'NO_GO',

    allowed:
      false,

    primaryReason:
      'NO_GO',

    evidence:
      [],

    humanSummary:
      'Decisão bloqueada por governança.'

  };



  const snapshot =
    builder.create(
      trace,
      explanation
    );



  assert.equal(
    snapshot.decisionId,
    'decision-001'
  );


  assert.equal(
    snapshot.schemaVersion,
    '2.9.0'
  );


  assert.equal(
    snapshot.allowed,
    false
  );


  assert.equal(
    snapshot.explanation.operationalGate,
    'NO_GO'
  );


  assert.equal(
    snapshot.auditTrace.sessionId,
    'session-001'
  );

});
