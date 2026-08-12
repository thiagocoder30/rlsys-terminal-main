const test = require('node:test');
const assert = require('node:assert/strict');
const {
  PositionSizingEngine,
} = require('../dist/domain/risk/PositionSizingEngine');

test('Sprint 374: PositionSizingEngine normaliza sizing por provider', () => {
  const sizing = new PositionSizingEngine();

  sizing.setProvider('PRAGMATIC');
  const pragmatic = sizing.calculateOperationalSizing(100, 92.8, 2.50);

  assert.equal(
    pragmatic.finalStake,
    2.50,
    'Sizing deveria preservar o custo base de R$ 2.50 na Pragmatic',
  );
  assert.equal(pragmatic.multiplier, 1);

  sizing.setProvider('EVOLUTION');
  const evolution = sizing.calculateOperationalSizing(100, 92.8, 2.50);

  assert.equal(
    evolution.finalStake,
    12.50,
    'Sizing deveria normalizar o piso da Evolution para R$ 12.50',
  );
  assert.equal(evolution.multiplier, 5);
});
