#!/data/data/com.termux/files/usr/bin/bash

set -e

echo "=================================================="
echo "RL.SYS CORE"
echo "SPRINT R1-K.11"
echo "Decision Governance Snapshot"
echo "=================================================="


cat > src/application/decision/DecisionGovernanceSnapshot.ts <<'TS'
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
TS



cat > tests/decision-governance-snapshot.test.js <<'TEST'
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DecisionGovernanceSnapshotBuilder
} = require('../dist/application/decision/DecisionGovernanceSnapshot');


test('DecisionGovernanceSnapshot consolidates governance evidence', () => {


  const builder =
    new DecisionGovernanceSnapshotBuilder();



  const trace = {

    decisionId:
      'decision-001',

    sessionId:
      'session-001',

    engineVersion:
      'strategy-decision-v1',

    schemaVersion:
      '2.9.0',

    action:
      'BLOCKED',

    operationalGate:
      'NO_GO',

    allowed:
      false,

    confidenceScore:
      0.2,

    riskScore:
      0.9,

    blockers:
      [
        'NO_GO'
      ],

    warnings:
      [],

    generatedAt:
      new Date().toISOString()

  };



  const explanation = {

    decisionId:
      'decision-001',

    decision:
      'BLOCKED',

    operationalGate:
      'NO_GO',

    allowed:
      false,

    primaryReason:
      'NO_GO',

    evidence:
      [],

    humanSummary:
      'Decisão bloqueada por governança.'

  };



  const snapshot =
    builder.create(
      trace,
      explanation
    );



  assert.equal(
    snapshot.decisionId,
    'decision-001'
  );


  assert.equal(
    snapshot.schemaVersion,
    '2.9.0'
  );


  assert.equal(
    snapshot.allowed,
    false
  );


  assert.equal(
    snapshot.explanation.operationalGate,
    'NO_GO'
  );


  assert.equal(
    snapshot.auditTrace.sessionId,
    'session-001'
  );

});
TEST



npx tsc


echo "=================================================="
echo "R1-K.11 COMPLETE"
echo "=================================================="

