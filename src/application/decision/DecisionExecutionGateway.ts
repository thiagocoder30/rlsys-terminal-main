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
