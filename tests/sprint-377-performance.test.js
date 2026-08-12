const test = require('node:test');
const assert = require('node:assert/strict');
const {
  StrategyPerformanceEvaluator,
} = require('../dist/domain/risk/StrategyPerformanceEvaluator');

test('Sprint 377: StrategyPerformanceEvaluator degrada, bloqueia e recupera estratégia', () => {
  const evaluator = new StrategyPerformanceEvaluator([
    'SECTOR_ALPHA',
    'HEDGE_BLACK_COL3',
  ]);

  assert.equal(evaluator.isAllowed('SECTOR_ALPHA'), true);
  assert.equal(evaluator.getWeight('SECTOR_ALPHA'), 1.0);

  evaluator.registerLoss('SECTOR_ALPHA');

  assert.equal(evaluator.getWeight('SECTOR_ALPHA'), 0.5);
  assert.equal(evaluator.isAllowed('SECTOR_ALPHA'), false);

  evaluator.registerLoss('SECTOR_ALPHA');

  assert.equal(evaluator.getWeight('SECTOR_ALPHA'), 0.1);
  assert.equal(evaluator.isAllowed('SECTOR_ALPHA'), false);

  evaluator.registerWin('SECTOR_ALPHA');
  evaluator.registerWin('SECTOR_ALPHA');

  assert.equal(evaluator.getWeight('SECTOR_ALPHA'), 0.5);
  assert.equal(evaluator.isAllowed('SECTOR_ALPHA'), false);

  evaluator.registerWin('SECTOR_ALPHA');

  assert.equal(evaluator.getWeight('SECTOR_ALPHA'), 0.7);
  assert.equal(evaluator.isAllowed('SECTOR_ALPHA'), true);
});
