const test = require('node:test');
const assert = require('node:assert/strict');
const { StatisticalSignificanceEngine } = require('../dist/domain/statistics/StatisticalSignificanceEngine');

test('StatisticalSignificanceEngine treats balanced roulette distribution as low evidence', () => {
  const engine = new StatisticalSignificanceEngine();
  const values = Array.from({ length: 37 * 20 }, (_, index) => index % 37);
  const report = engine.analyze(values);

  assert.equal(report.sampleSize, 740);
  assert.ok(report.pValue > 0.95);
  assert.equal(report.significantAt95, false);
  assert.equal(report.verdict, 'NO_EVIDENCE');
  assert.ok(report.normalizedEntropy > 0.99);
});

test('StatisticalSignificanceEngine flags concentrated deviation as significant', () => {
  const engine = new StatisticalSignificanceEngine();
  const values = [
    ...Array.from({ length: 260 }, () => 17),
    ...Array.from({ length: 37 * 10 }, (_, index) => index % 37)
  ];
  const report = engine.analyze(values);

  assert.equal(report.significantAt95, true);
  assert.ok(report.pValue < 0.01);
  assert.ok(['MODERATE_EVIDENCE', 'STRONG_EVIDENCE'].includes(report.verdict));
  assert.equal(report.topDeviations[0].value, 17);
});
