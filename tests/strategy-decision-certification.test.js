const test = require('node:test');
const assert = require('node:assert/strict');

const {
  StrategyDecisionService
} = require('../dist/application/decision/StrategyDecisionService');


function balancedHistory(size = 240) {
  return Array.from(
    { length: size },
    (_, index) => index % 37
  );
}


test('Decision certification preserves research-only governance contract', () => {
  const service = new StrategyDecisionService();

  const report = service.evaluate({
    source: 'manual',
    values: balancedHistory(),
    bankroll: 1000,
    sessionId: 'certification-clean'
  });

  assert.equal(report.service, 'StrategyDecisionService');
  assert.equal(report.schemaVersion, '2.9.0');

  assert.ok(report.decision);

  assert.equal(
    report.decision.execution.liveStakeFraction,
    0
  );

  assert.equal(
    report.decision.execution.mode,
    'RESEARCH_ONLY'
  );
});


test('Decision certification blocks invalid sessions', () => {
  const service = new StrategyDecisionService();

  const report = service.evaluate({
    values: [1, 2, 99],
    bankroll: 500
  });

  assert.equal(
    report.status,
    'REJECTED'
  );

  assert.equal(
    report.decision.action,
    'BLOCKED'
  );

  assert.equal(
    report.decision.operationalGate,
    'NO_GO'
  );
});


test('Decision certification never authorizes live stake', () => {
  const service = new StrategyDecisionService();

  const report = service.evaluate({
    values: balancedHistory(),
    bankroll: 1000
  });

  assert.equal(
    report.decision.execution.liveStakeFraction,
    0
  );
});
