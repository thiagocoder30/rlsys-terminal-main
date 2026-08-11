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
