const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DecisionGovernanceEnforcement
} = require('../dist/application/decision/DecisionGovernanceEnforcement');


test('DecisionGovernanceEnforcement blocks NO_GO runtime decisions', () => {


  const enforcement =
    new DecisionGovernanceEnforcement();


  const result =
    enforcement.enforce({

      decisionId:
        'decision-enforcement-001',

      sessionId:
        'session-enforcement-001',

      schemaVersion:
        '2.9.0',

      action:
        'BLOCKED',

      operationalGate:
        'NO_GO',

      allowed:
        false,

      executable:
        false,

      confidenceScore:
        0.15,

      riskScore:
        0.95,

      governanceStatus:
        'RUNTIME_BLOCKED',

      reason:
        'Warm-up classificou mesa como NO_GO',

    });


  assert.equal(
    result.decisionId,
    'decision-enforcement-001'
  );


  assert.equal(
    result.executable,
    false
  );


  assert.equal(
    result.executionStatus,
    'EXECUTION_BLOCKED'
  );


  assert.equal(
    result.operationalGate,
    'NO_GO'
  );


});


test('DecisionGovernanceEnforcement allows approved runtime decisions', () => {


  const enforcement =
    new DecisionGovernanceEnforcement();


  const result =
    enforcement.enforce({

      decisionId:
        'decision-enforcement-002',

      sessionId:
        'session-enforcement-002',

      schemaVersion:
        '2.9.0',

      action:
        'RESEARCH_ONLY',

      operationalGate:
        'SIGNAL',

      allowed:
        true,

      executable:
        true,

      confidenceScore:
        0.75,

      riskScore:
        0.12,

      governanceStatus:
        'RUNTIME_APPROVED',

      reason:
        'Critérios de governança atendidos'

    });


  assert.equal(
    result.executable,
    true
  );


  assert.equal(
    result.executionStatus,
    'EXECUTION_ALLOWED'
  );


  assert.equal(
    result.governanceStatus,
    'RUNTIME_APPROVED'
  );


});
