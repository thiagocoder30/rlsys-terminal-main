import {
  StrategyDecisionReport
} from '../../domain/decision/StrategyDecisionEngine';

import {
  DecisionAuditTrace,
  DecisionAuditTraceRecord
} from './DecisionAuditTrace';

import {
  DecisionExplanationService,
  DecisionExplanation
} from './DecisionExplanationService';

import {
  DecisionGovernanceSnapshotBuilder,
  DecisionGovernanceSnapshot
} from './DecisionGovernanceSnapshot';


export interface DecisionGovernanceIntegrationResult {

  readonly snapshot: DecisionGovernanceSnapshot;

  readonly trace: DecisionAuditTraceRecord;

  readonly explanation: DecisionExplanation;

}



export class DecisionGovernanceIntegration {

  private readonly traceService: DecisionAuditTrace;

  private readonly explanationService: DecisionExplanationService;

  private readonly snapshotBuilder: DecisionGovernanceSnapshotBuilder;


  public constructor() {

    this.traceService =
      new DecisionAuditTrace();

    this.explanationService =
      new DecisionExplanationService();

    this.snapshotBuilder =
      new DecisionGovernanceSnapshotBuilder();

  }



  public build(
    report: StrategyDecisionReport,
    schemaVersion: string
  ): DecisionGovernanceIntegrationResult {


    const trace =
      this.traceService.create(
        report,
        schemaVersion
      );


    const explanation =
      this.explanationService.explain(
        report
      );


    const snapshot =
      this.snapshotBuilder.create(
        trace,
        explanation
      );


    return {

      snapshot,

      trace,

      explanation

    };

  }

}
