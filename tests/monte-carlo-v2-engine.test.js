const test = require('node:test');
const assert = require('node:assert/strict');
const { MonteCarloV2Engine } = require('../dist/domain/simulation/MonteCarloV2Engine');

function balancedHistory(size = 220) {
  return Array.from({ length: size }, (_, index) => index % 37);
}

function concentratedHistory(size = 260) {
  const hot = [22, 18, 29, 7, 28, 12, 35, 3, 26];
  return Array.from({ length: size }, (_, index) => hot[index % hot.length]);
}

test('MonteCarloV2Engine returns bounded bootstrap risk metrics', () => {
  const engine = new MonteCarloV2Engine({ simulations: 60, seed: 'test-v2', blockSize: 7 });
  const report = engine.run(balancedHistory());

  assert.equal(report.engineVersion, 'monte-carlo-v2');
  assert.equal(report.summary.simulations, 60);
  assert.ok(report.summary.robustnessScore >= 0 && report.summary.robustnessScore <= 1);
  assert.ok(report.summary.fragilityIndex >= 0 && report.summary.fragilityIndex <= 1);
  assert.ok(report.summary.ruinProbability >= 0 && report.summary.ruinProbability <= 1);
  assert.equal(report.governance.operationalGate, 'BLOCKED');
  assert.ok(report.confidenceBands.endingCapital.p05 <= report.confidenceBands.endingCapital.p95);
});

test('MonteCarloV2Engine surfaces robust candidate without opening operational gate', () => {
  const engine = new MonteCarloV2Engine({ simulations: 70, seed: 'candidate-v2', blockSize: 6, stakeFraction: 0.006 });
  const report = engine.run(concentratedHistory());

  assert.equal(report.governance.operationalGate, 'BLOCKED');
  assert.ok(['RESEARCH_REVIEW', 'ROBUSTNESS_CANDIDATE', 'REJECTED'].includes(report.governance.reviewStatus));
  assert.ok(report.summary.bootstrapConsistency >= 0 && report.summary.bootstrapConsistency <= 1);
});

test('MonteCarloV2Engine rejects invalid histories', () => {
  const engine = new MonteCarloV2Engine({ simulations: 50 });
  assert.throws(() => engine.run([1, 2, 99]), /invalid_monte_carlo_v2_history/);
});
