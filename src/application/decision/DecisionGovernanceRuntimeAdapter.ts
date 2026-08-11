import {
  DecisionGovernanceSnapshot
} from './DecisionGovernanceSnapshot';


export interface RuntimeGovernanceDecision {

  readonly decisionId: string;

  readonly sessionId: string;

  readonly schemaVersion: string;

  readonly action: string;

  readonly operationalGate: string;

  readonly allowed: boolean;

  readonly executable: boolean;

  readonly confidenceScore: number;

  readonly riskScore: number;

  readonly governanceStatus: string;

  readonly reason: string;

  readonly createdAt: string;

}


export class DecisionGovernanceRuntimeAdapter {


  public adapt(
    snapshot: DecisionGovernanceSnapshot
  ): RuntimeGovernanceDecision {


    const executable =
      snapshot.allowed &&
      snapshot.operationalGate !== 'NO_GO';


    const governanceStatus =
      executable
        ? 'RUNTIME_APPROVED'
        :
        'RUNTIME_BLOCKED';


    const reason =
      snapshot.explanation.primaryReason;


    return {

      decisionId:
        snapshot.decisionId,

      sessionId:
        snapshot.sessionId,

      schemaVersion:
        snapshot.schemaVersion,

      action:
        snapshot.action,

      operationalGate:
        snapshot.operationalGate,

      allowed:
        snapshot.allowed,

      executable,

      confidenceScore:
        snapshot.confidenceScore,

      riskScore:
        snapshot.riskScore,

      governanceStatus,

      reason,

      createdAt:
        new Date().toISOString()

    };
  }
}
