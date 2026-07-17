import {
  DecisionAuditTraceRecord
} from './DecisionAuditTrace';

import {
  DecisionExplanation
} from './DecisionExplanationService';



export interface DecisionGovernanceSnapshot {

  readonly decisionId: string;

  readonly sessionId: string;

  readonly schemaVersion: string;

  readonly action: string;

  readonly operationalGate: string;

  readonly allowed: boolean;

  readonly confidenceScore: number;

  readonly riskScore: number;

  readonly explanation: DecisionExplanation;

  readonly auditTrace: DecisionAuditTraceRecord;

  readonly createdAt: string;

}



export class DecisionGovernanceSnapshotBuilder {


  public create(
    trace: DecisionAuditTraceRecord,
    explanation: DecisionExplanation
  ): DecisionGovernanceSnapshot {


    return {

      decisionId:
        trace.decisionId,

      sessionId:
        trace.sessionId,

      schemaVersion:
        trace.schemaVersion,

      action:
        trace.action,

      operationalGate:
        trace.operationalGate,

      allowed:
        trace.allowed,

      confidenceScore:
        trace.confidenceScore,

      riskScore:
        trace.riskScore,

      explanation,

      auditTrace:
        trace,

      createdAt:
        new Date().toISOString()

    };
  }
}
