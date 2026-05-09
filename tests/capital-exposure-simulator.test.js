const test = require('node:test');
const assert = require('node:assert/strict');
const { CapitalExposureSimulator } = require('../dist/domain/risk/CapitalExposureSimulator');

function repeating(values, times) {
  return Array.from({ length: times }, (_, index) => values[index % values.length]);
}

test('CapitalExposureSimulator returns bounded capital survival metrics', () => {
  const simulator = new CapitalExposureSimulator();
  const history = repeating([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18], 240);
  const analysis = simulator.simulate(history);

  assert.equal(analysis.summary.sampleSize, 240);
  assert.equal(analysis.summary.governance.operationalGate, 'BLOCKED');
  assert.ok(analysis.outcomes.length >= 5);
  assert.ok(analysis.summary.worstDrawdown >= 0 && analysis.summary.worstDrawdown <= 1);
  assert.ok(analysis.summary.worstRuinProbability >= 0 && analysis.summary.worstRuinProbability <= 1);
  assert.ok(analysis.summary.advancedRiskOfRuin.probability >= 0 && analysis.summary.advancedRiskOfRuin.probability <= 1);
  assert.ok(['REJECTED', 'RESEARCH_REVIEW', 'CAPITAL_RESILIENT_CANDIDATE'].includes(analysis.summary.governance.reviewStatus));
});

test('CapitalExposureSimulator rejects invalid roulette histories', () => {
  const simulator = new CapitalExposureSimulator();
  assert.throws(() => simulator.simulate([1, 2, 37, 4]), /invalid_capital_history/);
});

test('CapitalExposureSimulator flags aggressive capital pressure without opening operational gate', () => {
  const simulator = new CapitalExposureSimulator({ baseStakeFraction: 0.025, maxStakeFraction: 0.04 });
  const history = repeating([32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8], 260);
  const analysis = simulator.simulate(history);

  assert.equal(analysis.summary.governance.operationalGate, 'BLOCKED');
  assert.ok(analysis.summary.advancedRiskOfRuin.probability >= 0);
  assert.ok(analysis.summary.governance.circuitBreakers.length >= 0);
  assert.ok(analysis.outcomes.some(outcome => outcome.policy === 'martingale_like_rejected'));
});
