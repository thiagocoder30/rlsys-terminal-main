const test = require('node:test');
const assert = require('node:assert/strict');
const {
  OperatorRiskProfileCalculator,
  ConsciousProfitModeEngine,
} = require('../dist/domain/risk');

function profile() {
  return new OperatorRiskProfileCalculator().calculate({
    bankroll: 200,
    riskMode: 'CONSERVATIVE',
    allowMartingale: true,
  });
}

test('ConsciousProfitModeEngine keeps profit open below protection threshold', () => {
  const engine = new ConsciousProfitModeEngine();

  const result = engine.evaluate({
    profile: profile(),
    currentSessionPnl: 5,
  });

  assert.equal(result.state, 'PROFIT_OPEN');
  assert.equal(result.exposureMultiplier, 1);
  assert.equal(result.shouldSuggestStop, false);
});

test('ConsciousProfitModeEngine protects profit near stop win', () => {
  const engine = new ConsciousProfitModeEngine();

  const result = engine.evaluate({
    profile: profile(),
    currentSessionPnl: 12,
  });

  assert.equal(result.state, 'PROFIT_PROTECT');
  assert.equal(result.exposureMultiplier, 0.5);
  assert.equal(result.shouldSuggestStop, true);
  assert.match(result.reason, /Reduzir exposição/);
});

test('ConsciousProfitModeEngine locks profit at stop win', () => {
  const engine = new ConsciousProfitModeEngine();

  const result = engine.evaluate({
    profile: profile(),
    currentSessionPnl: 16,
  });

  assert.equal(result.state, 'PROFIT_LOCKED');
  assert.equal(result.exposureMultiplier, 0);
  assert.equal(result.shouldSuggestStop, true);
  assert.match(result.reason, /Meta de lucro/);
});

test('ConsciousProfitModeEngine rejects invalid pnl', () => {
  const engine = new ConsciousProfitModeEngine();

  assert.throws(() => engine.evaluate({
    profile: profile(),
    currentSessionPnl: Number.NaN,
  }), /currentSessionPnl/);
});
