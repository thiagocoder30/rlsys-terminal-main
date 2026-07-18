const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DecisionGovernanceRuntimeAdapter
} = require('../dist/application/decision/DecisionGovernanceRuntimeAdapter');


test('DecisionGovernanceRuntimeAdapter blocks unsafe governance states', () => {


  const adapter =
    new DecisionGovernanceRuntimeAdapter();


  const runtimeDecision =
    adapter.adapt({

      decisionId:
        'decision-runtime-001',

      sessionId:
        'session-runtime-001',

      schemaVersion:
        '2.9.0',

      action:
        'BLOCKED',

      operationalGate:
        'NO_GO',

      allowed:
        false,

      confidenceScore:
        0.25,

      riskScore:
        0.95,


      explanation: {

        decisionId:
          'decision-runtime-001',

        decision:
          'BLOCKED',

        operationalGate:
          'NO_GO',

        allowed:
          false,

        primaryReason:
          'Warm-up classificou mesa como NO_GO',

        evidence:
          [],

        humanSummary:
          'Decisão bloqueada por governança.'

      },


      auditTrace: {

        decisionId:
          'decision-runtime-001',

        sessionId:
          'session-runtime-001',

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
          0.25,

        riskScore:
          0.95,

        blockers:
          [
            'NO_GO'
          ],

        warnings:
          [],

        generatedAt:
          new Date().toISOString()

      },


      createdAt:
        new Date().toISOString()

    });



  assert.equal(
    runtimeDecision.decisionId,
    'decision-runtime-001'
  );


  assert.equal(
    runtimeDecision.operationalGate,
    'NO_GO'
  );


  assert.equal(
    runtimeDecision.executable,
    false
  );


  assert.equal(
    runtimeDecision.governanceStatus,
    'RUNTIME_BLOCKED'
  );


  assert.equal(
    runtimeDecision.schemaVersion,
    '2.9.0'
  );


});


test('DecisionGovernanceRuntimeAdapter allows research governance states', () => {


  const adapter =
    new DecisionGovernanceRuntimeAdapter();


  const runtimeDecision =
    adapter.adapt({

      decisionId:
        'decision-runtime-002',

      sessionId:
        'session-runtime-002',

      schemaVersion:
        '2.9.0',

      action:
        'RESEARCH_ONLY',

      operationalGate:
        'SIGNAL',

      allowed:
        true,

      confidenceScore:
        0.72,

      riskScore:
        0.18,


      explanation: {

        decisionId:
          'decision-runtime-002',

        decision:
          'RESEARCH_ONLY',

        operationalGate:
          'SIGNAL',

        allowed:
          true,

        primaryReason:
          'Critérios atendidos',

        evidence:
          [],

        humanSummary:
          'Decisão aprovada em modo pesquisa.'

      },


      auditTrace: {

        decisionId:
          'decision-runtime-002',

        sessionId:
          'session-runtime-002',

        engineVersion:
          'strategy-decision-v1',

        schemaVersion:
          '2.9.0',

        action:
          'RESEARCH_ONLY',

        operationalGate:
          'SIGNAL',

        allowed:
          true,

        confidenceScore:
          0.72,

        riskScore:
          0.18,

        blockers:
          [],

        warnings:
          [],

        generatedAt:
          new Date().toISOString()

      },


      createdAt:
        new Date().toISOString()

    });



  assert.equal(
    runtimeDecision.executable,
    true
  );


  assert.equal(
    runtimeDecision.governanceStatus,
    'RUNTIME_APPROVED'
  );


});
