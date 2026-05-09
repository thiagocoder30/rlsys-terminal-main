const test = require('node:test');
const assert = require('node:assert/strict');
const { StatisticalSignificanceEngine } = require('../dist/domain/statistics/StatisticalSignificanceEngine');
const { HypothesisValidator } = require('../dist/domain/statistics/HypothesisValidator');

test('HypothesisValidator keeps operational gate blocked without strong large-sample evidence', () => {
  const engine = new StatisticalSignificanceEngine();
  const validator = new HypothesisValidator();
  const values = Array.from({ length: 37 * 12 }, (_, index) => index % 37);
  const report = engine.analyze(values);
  const result = validator.validateUniformRandomness(report);

  assert.equal(result.productionGate, 'BLOCK');
  assert.ok(result.rationale.length > 0);
});
