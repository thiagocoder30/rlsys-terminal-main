const test = require('node:test');
const assert = require('node:assert');
const { AutoSettlementEngine } = require('../src/domain/financial/AutoSettlementEngine.js');

test('AutoSettlementEngine: Liquida Lucro Liquido corretamente', () => {
  const engine = new AutoSettlementEngine();
  const targets = [1, 3, 5, 7]; // Vermelhos fake
  const result = engine.evaluate(3, targets, 1.90, 2);
  assert.strictEqual(result.isWin, true);
  assert.strictEqual(result.netAmount, 1.90); // 3.80 - 1.90 = 1.90
});

test('AutoSettlementEngine: Liquida Loss corretamente', () => {
  const engine = new AutoSettlementEngine();
  const targets = [1, 3, 5, 7];
  const result = engine.evaluate(2, targets, 1.90, 2);
  assert.strictEqual(result.isWin, false);
  assert.strictEqual(result.netAmount, 1.90); // Perdeu a stake
});

test('AutoSettlementEngine: Trata o ZERO como Loss', () => {
  const engine = new AutoSettlementEngine();
  const targets = [1, 3, 5, 7];
  const result = engine.evaluate(0, targets, 1.90, 2);
  assert.strictEqual(result.isWin, false);
});
