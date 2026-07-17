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
