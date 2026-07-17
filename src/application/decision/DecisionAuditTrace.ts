import {
  StrategyDecisionReport
} from '../../domain/decision/StrategyDecisionEngine';


export interface DecisionAuditTraceRecord {

  readonly decisionId: string;

  readonly sessionId: string;

  readonly engineVersion: string;

  readonly schemaVersion: string;

  readonly action: string;

  readonly operationalGate: string;

  readonly allowed: boolean;

  readonly confidenceScore: number;

  readonly riskScore: number;

  readonly blockers: readonly string[];

  readonly warnings: readonly string[];

  readonly generatedAt: string;
}


export class DecisionAuditTrace {


  public create(
    report: StrategyDecisionReport,
    schemaVersion: string
  ): DecisionAuditTraceRecord {


    return {

      decisionId:
        report.reportId,

      sessionId:
        report.sessionId,

      engineVersion:
        report.engineVersion,

      schemaVersion,

      action:
        report.action,

      operationalGate:
        report.operationalGate,

      allowed:
        report.allowed,

      confidenceScore:
        report.confidenceScore,

      riskScore:
        report.riskScore,

      blockers:
        [...report.blockers],

      warnings:
        [...report.warnings],

      generatedAt:
        new Date().toISOString()
    };
  }
}
