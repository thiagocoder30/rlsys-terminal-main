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
