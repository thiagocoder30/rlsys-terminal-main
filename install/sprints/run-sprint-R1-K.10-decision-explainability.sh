#!/data/data/com.termux/files/usr/bin/bash

set -e

echo "=================================================="
echo "RL.SYS CORE"
echo "SPRINT R1-K.10"
echo "Decision Explainability Layer"
echo "=================================================="


cat > src/application/decision/DecisionExplanationService.ts <<'TS'
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
TS



cat > tests/decision-explanation.test.js <<'TEST'
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DecisionExplanationService
} = require('../dist/application/decision/DecisionExplanationService');


test('DecisionExplanationService explains governance decision', () => {


  const service =
    new DecisionExplanationService();



  const explanation =
    service.explain({

      reportId:
        'decision-xai-001',

      action:
        'BLOCKED',

      operationalGate:
        'NO_GO',

      allowed:
        false,

      blockers:
        [
          'Warm-up classificou mesa como NO_GO'
        ],

      warnings:
        [],

      rules:
        [
          {
            ruleId:
              'WARMUP_GATE',

            severity:
              'BLOCKER',

            riskContribution:
              0.92,

            message:
              'Warm-up classificou mesa como NO_GO.'
          }
        ]

    });



  assert.equal(
    explanation.decisionId,
    'decision-xai-001'
  );


  assert.equal(
    explanation.operationalGate,
    'NO_GO'
  );


  assert.equal(
    explanation.allowed,
    false
  );


  assert.equal(
    explanation.evidence.length,
    1
  );


  assert.ok(
    explanation.humanSummary.includes('bloqueada')
  );

});
TEST



npx tsc


echo "=================================================="
echo "R1-K.10 COMPLETE"
echo "=================================================="

