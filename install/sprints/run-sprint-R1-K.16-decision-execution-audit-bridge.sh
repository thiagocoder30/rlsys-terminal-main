#!/data/data/com.termux/files/usr/bin/bash

set -e

echo "=================================================="
echo "RL.SYS CORE"
echo "SPRINT R1-K.16"
echo "Decision Execution Audit Bridge"
echo "=================================================="


cat > src/application/decision/DecisionExecutionAuditBridge.ts <<'TS'
import {
  ExecutionGatewayResult
} from './DecisionExecutionGateway';


export interface ExecutionAuditEvent {

  readonly auditId: string;

  readonly decisionId: string;

  readonly sessionId: string;

  readonly executionStatus: string;

  readonly accepted: boolean;

  readonly governanceStatus: string;

  readonly operationalGate: string;

  readonly reason: string;

  readonly createdAt: string;

}



export class DecisionExecutionAuditBridge {


  public create(
    result: ExecutionGatewayResult
  ): ExecutionAuditEvent {


    const auditId =
      `execution-audit-${Date.now()}`;


    return {

      auditId,

      decisionId:
        result.decisionId,

      sessionId:
        result.sessionId,

      executionStatus:
        result.executionStatus,

      accepted:
        result.accepted,

      governanceStatus:
        result.governanceStatus,

      operationalGate:
        result.operationalGate,

      reason:
        result.reason,

      createdAt:
        new Date().toISOString()

    };
  }
}
TS


cat > tests/decision-execution-audit-bridge.test.js <<'TEST'
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
TEST


cat > tests/decision-execution-audit-bridge.test.js <<'TEST'
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
TEST


echo "=================================================="
echo "Compiling TypeScript"
echo "=================================================="


npx tsc


echo "=================================================="
echo "R1-K.16 COMPLETE"
echo "=================================================="

