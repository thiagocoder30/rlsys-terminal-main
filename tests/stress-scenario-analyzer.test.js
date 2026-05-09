const test = require('node:test');
const assert = require('node:assert/strict');
const { StressScenarioAnalyzer } = require('../dist/domain/risk/StressScenarioAnalyzer');

const rotating = Array.from({ length: 240 }, (_, index) => index % 37);
const concentrated = Array.from({ length: 260 }, (_, index) => index % 5 === 0 ? 17 : [17, 34, 6, 13, 36, 11][index % 6]);

test('StressScenarioAnalyzer returns bounded stress metrics and drawdown surface', () => {
  const result = new StressScenarioAnalyzer().analyze(rotating);
  assert.equal(result.summary.sampleSize, rotating.length);
  assert.ok(result.scenarios.length >= 5);
  assert.ok(result.drawdownSurface.length >= 12);
  assert.ok(result.summary.worstDrawdown >= 0 && result.summary.worstDrawdown <= 1);
  assert.ok(result.summary.tailRiskScore >= 0 && result.summary.tailRiskScore <= 1);
  assert.ok(result.summary.resilienceScore >= 0 && result.summary.resilienceScore <= 1);
});

test('StressScenarioAnalyzer rejects invalid roulette histories', () => {
  assert.throws(() => new StressScenarioAnalyzer().analyze([1, 2, 99, 4]), /invalid_stress_history/);
});

test('StressScenarioAnalyzer flags aggressive capital pressure without opening operational gate', () => {
  const result = new StressScenarioAnalyzer({ baseStakeFraction: 0.02 }).analyze(concentrated);
  assert.ok(['REJECTED', 'RESEARCH_REVIEW', 'RESILIENT_CANDIDATE'].includes(result.summary.approval));
  assert.ok(result.scenarios.some(scenario => ['WATCH', 'FAIL', 'PASS'].includes(scenario.riskGrade)));
  assert.ok(result.summary.worstRuinProbabilityProxy >= 0 && result.summary.worstRuinProbabilityProxy <= 1);
});
