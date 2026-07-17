#!/data/data/com.termux/files/usr/bin/bash

set -e

echo "=================================================="
echo "RL.SYS CORE"
echo "SPRINT R1-K.12"
echo "Decision Governance Integration Layer"
echo "=================================================="


cat > src/application/decision/DecisionGovernanceIntegration.ts <<'TS'
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
TS

cat > tests/decision-governance-integration.test.js <<'TEST'
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DecisionGovernanceIntegration
} = require('../dist/application/decision/DecisionGovernanceIntegration');



test('DecisionGovernanceIntegration produces complete governance package', () => {


  const integration =
    new DecisionGovernanceIntegration();



  const report = {

    reportId:
      'decision-integration-001',


    sessionId:
      'session-integration-001',


    engineVersion:
      'strategy-decision-v1',


    action:
      'BLOCKED',


    operationalGate:
      'NO_GO',


    allowed:
      false,


    confidenceScore:
      0.18,


    riskScore:
      0.91,


    blockers:
      [
        'Warm-up gate rejected execution'
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
            0.91,


          message:
            'Session blocked by warm-up governance.'

        }

      ]

  };



  const result =
    integration.build(
      report,
      '2.9.0'
    );



  assert.equal(
    result.trace.decisionId,
    'decision-integration-001'
  );



  assert.equal(
    result.explanation.allowed,
    false
  );



  assert.equal(
    result.snapshot.schemaVersion,
    '2.9.0'
  );



  assert.equal(
    result.snapshot.operationalGate,
    'NO_GO'
  );



  assert.equal(
    result.snapshot.auditTrace.sessionId,
    'session-integration-001'
  );


});
TEST

echo "=================================================="
echo "Compiling TypeScript"
echo "=================================================="

npx tsc

echo "=================================================="
echo "R1-K.12 COMPLETE"
echo "=================================================="

