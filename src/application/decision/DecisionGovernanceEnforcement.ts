import {
  RuntimeGovernanceDecision
} from './DecisionGovernanceRuntimeAdapter';


export interface GovernanceExecutionDecision {

  readonly decisionId: string;

  readonly sessionId: string;

  readonly executable: boolean;

  readonly executionStatus: string;

  readonly governanceStatus: string;

  readonly operationalGate: string;

  readonly reason: string;

  readonly createdAt: string;

}


export class DecisionGovernanceEnforcement {


  public enforce(
    decision: RuntimeGovernanceDecision
  ): GovernanceExecutionDecision {


    const executable =
      decision.allowed &&
      decision.executable &&
      decision.operationalGate !== 'NO_GO' &&
      decision.governanceStatus === 'RUNTIME_APPROVED';


    const executionStatus =
      executable
        ? 'EXECUTION_ALLOWED'
        :
        'EXECUTION_BLOCKED';


    const reason =
      executable
        ? 'Governança aprovada para execução.'
        :
        decision.reason;


    return {

      decisionId:
        decision.decisionId,

      sessionId:
        decision.sessionId,

      executable,

      executionStatus,

      governanceStatus:
        decision.governanceStatus,

      operationalGate:
        decision.operationalGate,

      reason,

      createdAt:
        new Date().toISOString()

    };
  }
}
