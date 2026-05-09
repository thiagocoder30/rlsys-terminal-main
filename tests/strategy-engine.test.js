const test = require('node:test');
const assert = require('node:assert/strict');
const { RouletteStats } = require('../dist/domain/services/RouletteStats');
const { StrategyEngine } = require('../dist/domain/services/StrategyEngine');
const { BacktestEngine } = require('../dist/domain/services/BacktestEngine');
const { RiskPolicy } = require('../dist/domain/services/RiskPolicy');

test('RouletteStats rejects invalid roulette numbers', () => {
  const result = RouletteStats.validate([0, 1, 36, 37, -1, 'x']);
  assert.equal(result.ok, false);
  assert.equal(result.values.length, 3);
  assert.ok(result.errors.length >= 3);
});

test('StrategyEngine locks insufficient samples', () => {
  const engine = new StrategyEngine();
  assert.equal(engine.analyze([1, 2, 3]), null);
});

test('StrategyEngine returns institutional analysis shape for valid sample', () => {
  const history = Array.from({ length: 140 }, (_, index) => index % 37);
  const engine = new StrategyEngine({ minSectorAbsZScore: 99 });
  const analysis = engine.analyze(history);
  assert.ok(analysis);
  assert.equal(analysis.status, 'LOCKED');
  assert.equal(Array.isArray(analysis.signals), true);
  assert.equal(typeof analysis.metrics.normalizedEntropy, 'number');
});

test('BacktestEngine produces a stable walk-forward summary', () => {
  const history = Array.from({ length: 260 }, (_, index) => index % 37);
  const backtest = new BacktestEngine({ minSectorAbsZScore: 1.5 }).runWalkForward(history);
  assert.equal(typeof backtest.summary.trades, 'number');
  assert.equal(typeof backtest.summary.maxDrawdown, 'number');
  assert.equal(Array.isArray(backtest.trades), true);
});

test('RiskPolicy blocks strategy without enough walk-forward evidence', () => {
  const history = Array.from({ length: 140 }, (_, index) => index % 37);
  const analysis = new StrategyEngine({ minSectorAbsZScore: 1.5 }).analyze(history);
  assert.ok(analysis);
  const decision = new RiskPolicy().evaluate(analysis);
  assert.equal(decision.allowed, false);
});
