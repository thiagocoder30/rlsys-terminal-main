#!/data/data/com.termux/files/usr/bin/bash

set -e

echo "=================================================="
echo "RL.SYS CORE"
echo "SPRINT R1-K.8"
echo "Decision Audit Trace"
echo "=================================================="


cat > src/application/decision/DecisionAuditTrace.ts <<'TS'
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
TS


cat > tests/decision-audit-trace.test.js <<'TEST'
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DecisionAuditTrace
} = require('../dist/application/decision/DecisionAuditTrace');


test('DecisionAuditTrace preserves decision governance evidence', () => {

  const trace =
    new DecisionAuditTrace();


  const record =
    trace.create(
      {
        reportId: 'decision-001',
        sessionId: 'session-001',
        engineVersion: 'strategy-decision-v1',
        action: 'BLOCKED',
        operationalGate: 'NO_GO',
        allowed: false,
        confidenceScore: 0.2,
        riskScore: 0.9,
        blockers: ['NO_GO'],
        warnings: []
      },
      '2.9.0'
    );


  assert.equal(
    record.decisionId,
    'decision-001'
  );

  assert.equal(
    record.operationalGate,
    'NO_GO'
  );

  assert.equal(
    record.allowed,
    false
  );

  assert.equal(
    record.schemaVersion,
    '2.9.0'
  );

});
TEST


npx tsc


echo "=================================================="
echo "R1-K.8 COMPLETE"
echo "=================================================="

