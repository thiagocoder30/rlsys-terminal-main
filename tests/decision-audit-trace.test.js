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
