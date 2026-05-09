const test = require('node:test');
const assert = require('node:assert/strict');
const { AdvancedWalkForwardValidator } = require('../dist/domain/backtesting/AdvancedWalkForwardValidator');

function rotatingDataset(size = 900) {
  return Array.from({ length: size }, (_, index) => index % 37);
}

function persistentVoisinsDataset(size = 900) {
  const voisins = [22, 18, 29, 7, 28, 12, 35, 3, 26, 0, 32, 15, 19, 4, 21, 2, 25];
  return Array.from({ length: size }, (_, index) => index % 5 === 0 ? (index % 37) : voisins[index % voisins.length]);
}

test('AdvancedWalkForwardValidator rejects invalid roulette history', () => {
  const validator = new AdvancedWalkForwardValidator({ trainingWindow: 30, validationWindow: 10, minFolds: 2, minTrades: 20 });
  assert.throws(() => validator.evaluate([0, 1, 99]), /invalid_walk_forward_history/);
});

test('AdvancedWalkForwardValidator detects low robustness on balanced data', () => {
  const validator = new AdvancedWalkForwardValidator({ trainingWindow: 120, validationWindow: 40, stepSize: 40, minFolds: 3, minTrades: 80 });
  const result = validator.evaluate(rotatingDataset());
  assert.equal(result.summary.approval !== 'CANDIDATE', true);
  assert.equal(result.summary.robustnessScore >= 0 && result.summary.robustnessScore <= 1, true);
});

test('AdvancedWalkForwardValidator surfaces candidate for persistent out-of-sample bias', () => {
  const validator = new AdvancedWalkForwardValidator({ trainingWindow: 120, validationWindow: 40, stepSize: 40, minFolds: 3, minTrades: 80 });
  const result = validator.evaluate(persistentVoisinsDataset());
  assert.equal(result.summary.meanValidationEdge > 0, true);
  assert.equal(result.summary.outOfSampleConsistency > 0.5, true);
  assert.equal(['RESEARCH_REVIEW', 'CANDIDATE'].includes(result.summary.approval), true);
});
