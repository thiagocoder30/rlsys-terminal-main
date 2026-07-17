#!/data/data/com.termux/files/usr/bin/bash

set -e

echo "=================================================="
echo "RL.SYS CORE"
echo "SPRINT R1-K.15"
echo "Decision Governance Execution Gateway"
echo "=================================================="


cat > src/application/decision/DecisionExecutionGateway.ts <<'TS'
import {
  GovernanceExecutionDecision
} from './DecisionGovernanceEnforcement';


export interface ExecutionGatewayResult {

  readonly decisionId: string;

  readonly sessionId: string;

  readonly accepted: boolean;

  readonly executionStatus: string;

  readonly governanceStatus: string;

  readonly operationalGate: string;

  readonly reason: string;

  readonly requestedAt: string;

}


export class DecisionExecutionGateway {


  public executeRequest(
    decision: GovernanceExecutionDecision
  ): ExecutionGatewayResult {


    const accepted =
      decision.executable &&
      decision.executionStatus === 'EXECUTION_ALLOWED';


    const executionStatus =
      accepted
        ? 'GATEWAY_ACCEPTED'
        :
        'GATEWAY_REJECTED';


    const reason =
      accepted
        ? 'Execução aceita pelo gateway de governança.'
        :
        decision.reason;


    return {

      decisionId:
        decision.decisionId,

      sessionId:
        decision.sessionId,

      accepted,

      executionStatus,

      governanceStatus:
        decision.governanceStatus,

      operationalGate:
        decision.operationalGate,

      reason,

      requestedAt:
        new Date().toISOString()

    };
  }
}
TS


cat > tests/decision-execution-gateway.test.js <<'TEST'
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
TEST


echo "=================================================="
echo "Compiling TypeScript"
echo "=================================================="


npx tsc


echo "=================================================="
echo "R1-K.15 COMPLETE"
echo "=================================================="

