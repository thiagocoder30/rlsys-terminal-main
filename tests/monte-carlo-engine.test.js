const test = require('node:test');
const assert = require('node:assert/strict');
const { MonteCarloEngine } = require('../dist/domain/services/MonteCarloEngine');

test('MonteCarloEngine returns bounded institutional risk metrics', () => {
  const engine = new MonteCarloEngine();
  const result = engine.runFromBacktest({
    trades: 80,
    wins: 35,
    losses: 45,
    hitRate: 35 / 80,
    roi: 0.04,
    maxDrawdown: 0.12,
    expectancyPerTrade: 0.001,
    finalEquity: 1.04
  }, { simulations: 100, horizonTrades: 50, seed: 42 });

  assert.equal(result.simulations, 100);
  assert.equal(result.horizonTrades, 50);
  assert.ok(result.probabilityOfRuin >= 0 && result.probabilityOfRuin <= 1);
  assert.ok(result.p95MaxDrawdown >= 0 && result.p95MaxDrawdown <= 1);
  assert.ok(result.p05FinalEquity > 0);
});
