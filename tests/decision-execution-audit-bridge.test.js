const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DecisionExecutionAuditBridge
} = require('../dist/application/decision/DecisionExecutionAuditBridge');


test('DecisionExecutionAuditBridge creates execution audit event', () => {


  const bridge =
    new DecisionExecutionAuditBridge();


  const event =
    bridge.create({

      decisionId:
        'decision-audit-001',

      sessionId:
        'session-audit-001',

      accepted:
        true,

      executionStatus:
        'GATEWAY_ACCEPTED',

      governanceStatus:
        'RUNTIME_APPROVED',

      operationalGate:
        'SIGNAL',

      reason:
        'Governança aprovada.',

      requestedAt:
        new Date().toISOString()

    });


  assert.equal(
    event.decisionId,
    'decision-audit-001'
  );


  assert.equal(
    event.sessionId,
    'session-audit-001'
  );


  assert.equal(
    event.accepted,
    true
  );


  assert.equal(
    event.executionStatus,
    'GATEWAY_ACCEPTED'
  );


  assert.equal(
    event.governanceStatus,
    'RUNTIME_APPROVED'
  );


  assert.ok(
    event.auditId.startsWith('execution-audit-')
  );


});


test('DecisionExecutionAuditBridge preserves blocked executions', () => {


  const bridge =
    new DecisionExecutionAuditBridge();


  const event =
    bridge.create({

      decisionId:
        'decision-audit-002',

      sessionId:
        'session-audit-002',

      accepted:
        false,

      executionStatus:
        'GATEWAY_REJECTED',

      governanceStatus:
        'RUNTIME_BLOCKED',

      operationalGate:
        'NO_GO',

      reason:
        'Governança bloqueou execução.',

      requestedAt:
        new Date().toISOString()

    });


  assert.equal(
    event.accepted,
    false
  );


  assert.equal(
    event.executionStatus,
    'GATEWAY_REJECTED'
  );


  assert.equal(
    event.operationalGate,
    'NO_GO'
  );


  assert.equal(
    event.reason,
    'Governança bloqueou execução.'
  );


});
