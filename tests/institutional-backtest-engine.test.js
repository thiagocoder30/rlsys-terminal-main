const test = require('node:test');
const assert = require('node:assert/strict');
const { InstitutionalBacktestEngine } = require('../dist/domain/backtesting/InstitutionalBacktestEngine');

function concentratedHistory(size = 900) {
  return Array.from({ length: size }, (_, index) => [31, 32, 33, 34, 35, 36, 30, 29, 31, 32][index % 10]);
}

test('InstitutionalBacktestEngine returns bounded institutional metrics and gates', () => {
  const engine = new InstitutionalBacktestEngine({
    trainingWindow: 180,
    testWindow: 45,
    stepSize: 45,
    engineOptions: { minSampleSize: 120, minSectorAbsZScore: 1.1 }
  });
  const result = engine.run(concentratedHistory());

  assert.ok(result.summary.sampleSize >= 900);
  assert.ok(result.summary.windows >= 1);
  assert.ok(result.summary.trades >= 0);
  assert.ok(result.summary.maxDrawdown >= 0 && result.summary.maxDrawdown <= 1);
  assert.ok(result.summary.riskOfRuinProxy >= 0 && result.summary.riskOfRuinProxy <= 1);
  assert.ok(['REJECTED', 'RESEARCH_REVIEW', 'CANDIDATE'].includes(result.summary.approval));
  assert.equal(result.baseline.policy, 'RANDOM_SECTOR');
  assert.equal(result.stress.length, 3);
  assert.equal(result.drawdownSurface.length, 5);
});

test('InstitutionalBacktestEngine rejects invalid roulette history', () => {
  const engine = new InstitutionalBacktestEngine();
  assert.throws(() => engine.run([0, 1, 37]), /invalid_backtest_history/);
});
