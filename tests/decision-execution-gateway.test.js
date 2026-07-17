const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DecisionExecutionGateway
} = require('../dist/application/decision/DecisionExecutionGateway');


test('DecisionExecutionGateway rejects blocked governance decisions', () => {


  const gateway =
    new DecisionExecutionGateway();


  const result =
    gateway.executeRequest({

      decisionId:
        'decision-gateway-001',

      sessionId:
        'session-gateway-001',

      executable:
        false,

      executionStatus:
        'EXECUTION_BLOCKED',

      governanceStatus:
        'RUNTIME_BLOCKED',

      operationalGate:
        'NO_GO',

      reason:
        'Governança bloqueou execução.'

    });


  assert.equal(
    result.decisionId,
    'decision-gateway-001'
  );


  assert.equal(
    result.accepted,
    false
  );


  assert.equal(
    result.executionStatus,
    'GATEWAY_REJECTED'
  );


  assert.equal(
    result.governanceStatus,
    'RUNTIME_BLOCKED'
  );


});


test('DecisionExecutionGateway accepts approved governance decisions', () => {


  const gateway =
    new DecisionExecutionGateway();


  const result =
    gateway.executeRequest({

      decisionId:
        'decision-gateway-002',

      sessionId:
        'session-gateway-002',

      executable:
        true,

      executionStatus:
        'EXECUTION_ALLOWED',

      governanceStatus:
        'RUNTIME_APPROVED',

      operationalGate:
        'SIGNAL',

      reason:
        'Governança aprovada.'

    });


  assert.equal(
    result.accepted,
    true
  );


  assert.equal(
    result.executionStatus,
    'GATEWAY_ACCEPTED'
  );


  assert.equal(
    result.governanceStatus,
    'RUNTIME_APPROVED'
  );


});
