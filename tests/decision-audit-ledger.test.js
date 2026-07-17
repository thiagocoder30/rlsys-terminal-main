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
