import {
  StrategyDecisionReport
} from '../../domain/decision/StrategyDecisionEngine';



export interface DecisionExplanationEvidence {

  readonly rule: string;

  readonly severity: string;

  readonly impact: number;

  readonly message: string;
}



export interface DecisionExplanation {

  readonly decisionId: string;

  readonly decision: string;

  readonly operationalGate: string;

  readonly allowed: boolean;

  readonly primaryReason: string;

  readonly evidence: readonly DecisionExplanationEvidence[];

  readonly humanSummary: string;

}



export class DecisionExplanationService {


  public explain(
    report: StrategyDecisionReport
  ): DecisionExplanation {


    const evidence =
      report.rules.map(
        rule => ({

          rule:
            rule.ruleId,

          severity:
            rule.severity,

          impact:
            rule.riskContribution,

          message:
            rule.message
        })
      );


    const primaryReason =
      report.blockers.length > 0
        ? report.blockers[0]
        :
        report.warnings.length > 0
          ? report.warnings[0]
          :
          'Decisão aceita pelos critérios atuais.';



    const humanSummary =
      report.allowed
        ?
        `Decisão ${report.action} aprovada em modo pesquisa.`
        :
        `Decisão ${report.action} bloqueada por critérios de governança.`;



    return {

      decisionId:
        report.reportId,

      decision:
        report.action,

      operationalGate:
        report.operationalGate,

      allowed:
        report.allowed,

      primaryReason,

      evidence,

      humanSummary
    };
  }
}
