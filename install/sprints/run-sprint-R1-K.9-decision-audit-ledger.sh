#!/data/data/com.termux/files/usr/bin/bash

set -e

echo "=================================================="
echo "RL.SYS CORE"
echo "SPRINT R1-K.9"
echo "Decision Audit Ledger"
echo "=================================================="


mkdir -p data/audit


cat > src/application/decision/DecisionAuditLedger.ts <<'TS'
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync
} from 'fs';

import {
  dirname
} from 'path';

import {
  DecisionAuditTraceRecord
} from './DecisionAuditTrace';


export class DecisionAuditLedger {


  private readonly filePath: string;


  public constructor(
    filePath = 'data/audit/decision-events.jsonl'
  ) {

    this.filePath = filePath;

    const directory =
      dirname(this.filePath);

    if (!existsSync(directory)) {
      mkdirSync(
        directory,
        {
          recursive: true
        }
      );
    }
  }



  public append(
    record: DecisionAuditTraceRecord
  ): void {

    appendFileSync(
      this.filePath,
      JSON.stringify(record) + '\n',
      'utf8'
    );
  }



  public findBySession(
    sessionId: string
  ): readonly DecisionAuditTraceRecord[] {

    if (!existsSync(this.filePath)) {
      return [];
    }


    return readFileSync(
      this.filePath,
      'utf8'
    )
      .split('\n')
      .filter(Boolean)
      .map(
        line =>
          JSON.parse(line)
      )
      .filter(
        record =>
          record.sessionId === sessionId
      );
  }



  public count(): number {

    if (!existsSync(this.filePath)) {
      return 0;
    }


    return readFileSync(
      this.filePath,
      'utf8'
    )
      .split('\n')
      .filter(Boolean)
      .length;
  }
}
TS



cat > tests/decision-audit-ledger.test.js <<'TEST'
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const {
  DecisionAuditLedger
} = require('../dist/application/decision/DecisionAuditLedger');


test('DecisionAuditLedger stores append-only decision events', () => {

  const path =
    'data/audit/test-decision-events.jsonl';


  if (fs.existsSync(path)) {
    fs.unlinkSync(path);
  }


  const ledger =
    new DecisionAuditLedger(path);


  ledger.append({
    decisionId: 'decision-001',
    sessionId: 'session-A',
    engineVersion: 'strategy-decision-v1',
    schemaVersion: '2.9.0',
    action: 'BLOCKED',
    operationalGate: 'NO_GO',
    allowed: false,
    confidenceScore: 0.2,
    riskScore: 0.9,
    blockers: ['NO_GO'],
    warnings: [],
    generatedAt: new Date().toISOString()
  });


  ledger.append({
    decisionId: 'decision-002',
    sessionId: 'session-B',
    engineVersion: 'strategy-decision-v1',
    schemaVersion: '2.9.0',
    action: 'OBSERVE',
    operationalGate: 'OBSERVE',
    allowed: false,
    confidenceScore: 0.4,
    riskScore: 0.5,
    blockers: [],
    warnings: ['review'],
    generatedAt: new Date().toISOString()
  });


  assert.equal(
    ledger.count(),
    2
  );


  assert.equal(
    ledger.findBySession('session-A').length,
    1
  );


  assert.equal(
    ledger.findBySession('session-A')[0].decisionId,
    'decision-001'
  );

});
TEST



npx tsc


echo "=================================================="
echo "R1-K.9 COMPLETE"
echo "=================================================="

