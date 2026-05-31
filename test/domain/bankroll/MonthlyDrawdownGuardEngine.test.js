'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  MonthlyDrawdownGuardEngine,
  MonthlyDrawdownGuardDecision,
  MonthlyDrawdownGuardReason,
} = require('../../../src/domain/bankroll/MonthlyDrawdownGuardEngine.js');

function baseInput(overrides) {
  return Object.assign({
    startingMonthlyBankroll: 100,
    currentBankroll: 90,
    productionMoneyAllowed: false,
  }, overrides || {});
}

test('allows paper session when monthly drawdown is below warning threshold', () => {
  const result = new MonthlyDrawdownGuardEngine().evaluate(baseInput({ currentBankroll: 90 }));

  assert.equal(result.ok, true);
  assert.equal(result.value.decision, MonthlyDrawdownGuardDecision.PAPER_COMPATIVEL);
  assert.equal(result.value.reason, MonthlyDrawdownGuardReason.BELOW_WARNING);
  assert.equal(result.value.productionMoneyAllowed, false);
});

test('warns when monthly drawdown reaches warning threshold', () => {
  const result = new MonthlyDrawdownGuardEngine().evaluate(baseInput({ currentBankroll: 80 }));

  assert.equal(result.ok, true);
  assert.equal(result.value.decision, MonthlyDrawdownGuardDecision.AGUARDAR);
  assert.equal(result.value.reason, MonthlyDrawdownGuardReason.WARNING_REACHED);
});

test('blocks when monthly drawdown reaches institutional limit', () => {
  const result = new MonthlyDrawdownGuardEngine().evaluate(baseInput({ currentBankroll: 75 }));

  assert.equal(result.ok, true);
  assert.equal(result.value.decision, MonthlyDrawdownGuardDecision.NAO_UTILIZAR);
  assert.equal(result.value.reason, MonthlyDrawdownGuardReason.LIMIT_REACHED);
});

test('allows user to reduce monthly drawdown limit', () => {
  const result = new MonthlyDrawdownGuardEngine().evaluate(baseInput({
    currentBankroll: 91,
    userMonthlyDrawdownLimitPercent: 10,
  }));

  assert.equal(result.ok, true);
  assert.equal(result.value.effectiveMonthlyDrawdownLimitPercent, 10);
  assert.equal(result.value.decision, MonthlyDrawdownGuardDecision.AGUARDAR);
});

test('prevents user from increasing monthly drawdown limit', () => {
  const result = new MonthlyDrawdownGuardEngine().evaluate(baseInput({
    currentBankroll: 99,
    userMonthlyDrawdownLimitPercent: 50,
  }));

  assert.equal(result.ok, true);
  assert.equal(result.value.decision, MonthlyDrawdownGuardDecision.NAO_UTILIZAR);
  assert.equal(result.value.reason, MonthlyDrawdownGuardReason.USER_LIMIT_ABOVE_INSTITUTIONAL_CAP);
  assert.equal(result.value.effectiveMonthlyDrawdownLimitPercent, 25);
});

test('does not count monthly growth as drawdown', () => {
  const result = new MonthlyDrawdownGuardEngine().evaluate(baseInput({ currentBankroll: 120 }));

  assert.equal(result.ok, true);
  assert.equal(result.value.monthlyDrawdownAmount, 0);
  assert.equal(result.value.decision, MonthlyDrawdownGuardDecision.PAPER_COMPATIVEL);
});

test('rejects invalid starting bankroll safely', () => {
  const result = new MonthlyDrawdownGuardEngine().evaluate(baseInput({ startingMonthlyBankroll: 0 }));

  assert.equal(result.ok, false);
  assert.equal(result.error.reason, MonthlyDrawdownGuardReason.INVALID_INPUT);
});

test('rejects invalid current bankroll safely', () => {
  const result = new MonthlyDrawdownGuardEngine().evaluate(baseInput({ currentBankroll: -1 }));

  assert.equal(result.ok, false);
  assert.equal(result.error.reason, MonthlyDrawdownGuardReason.INVALID_INPUT);
});

test('rejects live money invariant violations', () => {
  const result = new MonthlyDrawdownGuardEngine().evaluate(baseInput({ productionMoneyAllowed: true }));

  assert.equal(result.ok, false);
  assert.equal(result.error.reason, MonthlyDrawdownGuardReason.LIVE_MONEY_FORBIDDEN);
});

test('rejects missing input safely', () => {
  const result = new MonthlyDrawdownGuardEngine().evaluate(null);

  assert.equal(result.ok, false);
  assert.equal(result.error.reason, MonthlyDrawdownGuardReason.INVALID_INPUT);
});

test('is deterministic and idempotent', () => {
  const engine = new MonthlyDrawdownGuardEngine();
  const input = baseInput({
    startingMonthlyBankroll: 250,
    currentBankroll: 212.5,
    userMonthlyDrawdownLimitPercent: 18,
  });

  assert.deepEqual(engine.evaluate(input), engine.evaluate(input));
});

test('validates configuration defensively', () => {
  const result = new MonthlyDrawdownGuardEngine({
    institutionalMonthlyDrawdownLimitPercent: 80,
  }).evaluate(baseInput());

  assert.equal(result.ok, false);
  assert.equal(result.error.reason, MonthlyDrawdownGuardReason.INVALID_CONFIG);
});
