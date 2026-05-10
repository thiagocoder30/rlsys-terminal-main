const test = require('node:test');
const assert = require('node:assert/strict');
const { StrategyDecisionService } = require('../dist/application/decision/StrategyDecisionService');

function balancedHistory(size = 240) {
  return Array.from({ length: size }, (_, index) => index % 37);
}

test('StrategyDecisionService returns blocked governance decision for clean session', () => {
  const service = new StrategyDecisionService();
  const values = balancedHistory(240);
  const report = service.evaluate({ source: 'manual', values, bankroll: 1000, sessionId: 'manual-session' });

  assert.equal(report.service, 'StrategyDecisionService');
  assert.equal(report.schemaVersion, '2.8.0');
  assert.equal(report.sessionId, 'manual-session');
  assert.equal(report.decision.operationalGate, 'BLOCKED');
  assert.equal(report.decision.execution.liveStakeFraction, 0);
  assert.ok(['REJECTED', 'WATCHLIST', 'RESEARCH_CANDIDATE'].includes(report.status));
});

test('StrategyDecisionService rejects corrupted tiny sessions through decision blockers', () => {
  const service = new StrategyDecisionService();
  const report = service.evaluate({ values: [1, 2, 99], bankroll: 500 });

  assert.equal(report.service, 'StrategyDecisionService');
  assert.equal(report.status, 'REJECTED');
  assert.equal(report.decision.action, 'BLOCKED');
  assert.equal(report.decision.operationalGate, 'BLOCKED');
});
