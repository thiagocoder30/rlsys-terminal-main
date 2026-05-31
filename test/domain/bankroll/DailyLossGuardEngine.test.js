'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { DailyLossGuardEngine } = require('../../../src/domain/bankroll/DailyLossGuardEngine');

test('allows paper session when daily loss is below warning threshold', () => {
  const result = new DailyLossGuardEngine().evaluate({
    bankroll: 100,
    dailyNetUnits: -2
  });

  assert.equal(result.status, 'DAILY_LOSS_GUARD_OK');
  assert.equal(result.allowed, true);
  assert.equal(result.action, 'ALLOW_PAPER_SESSION');
  assert.equal(result.effectiveDailyLossLimit, 5);
  assert.equal(result.dailyLossAmount, 2);
  assert.equal(result.usagePercent, 40);
  assert.equal(result.paperGate, 'PAPER_AUTHORIZED');
  assert.equal(result.liveGate, 'BLOCKED');
  assert.equal(result.productionMoneyAllowed, false);
  assert.equal(result.liveMoneyAuthorized, false);
});

test('warns when daily loss reaches warning threshold but not full limit', () => {
  const result = new DailyLossGuardEngine().evaluate({
    bankroll: 100,
    dailyNetUnits: -4
  });

  assert.equal(result.status, 'DAILY_LOSS_GUARD_WARNING');
  assert.equal(result.allowed, true);
  assert.equal(result.action, 'ALLOW_WITH_CAUTION');
  assert.equal(result.usagePercent, 80);
  assert.ok(result.reasons.includes('daily_loss_warning_threshold_reached'));
});

test('blocks session when daily loss reaches effective limit', () => {
  const result = new DailyLossGuardEngine().evaluate({
    bankroll: 100,
    dailyNetUnits: -5
  });

  assert.equal(result.status, 'DAILY_LOSS_GUARD_BLOCKED');
  assert.equal(result.allowed, false);
  assert.equal(result.action, 'BLOCK_SESSION_UNTIL_NEXT_DAY');
  assert.equal(result.bankrollGate, 'BLOCKED');
  assert.equal(result.operationalGate, 'BLOCKED');
  assert.equal(result.paperGate, 'BLOCKED');
  assert.ok(result.reasons.includes('daily_loss_limit_reached'));
});

test('allows user to tighten limit below institutional cap', () => {
  const result = new DailyLossGuardEngine().evaluate({
    bankroll: 100,
    dailyNetUnits: -3,
    userDailyLossLimit: 3
  });

  assert.equal(result.status, 'DAILY_LOSS_GUARD_BLOCKED');
  assert.equal(result.effectiveDailyLossLimit, 3);
  assert.ok(result.reasons.includes('daily_loss_limit_reached'));
});

test('prevents user from loosening limit above institutional cap', () => {
  const result = new DailyLossGuardEngine().evaluate({
    bankroll: 100,
    dailyNetUnits: -6,
    userDailyLossLimit: 20
  });

  assert.equal(result.status, 'DAILY_LOSS_GUARD_BLOCKED');
  assert.equal(result.institutionalDailyLossLimit, 5);
  assert.equal(result.effectiveDailyLossLimit, 5);
  assert.ok(result.reasons.includes('daily_loss_limit_reached'));
});

test('does not count positive daily net as loss', () => {
  const result = new DailyLossGuardEngine().evaluate({
    bankroll: 100,
    dailyNetUnits: 10
  });

  assert.equal(result.status, 'DAILY_LOSS_GUARD_OK');
  assert.equal(result.dailyLossAmount, 0);
  assert.equal(result.usagePercent, 0);
});

test('blocks invalid bankroll safely', () => {
  const result = new DailyLossGuardEngine().evaluate({
    bankroll: 0,
    dailyNetUnits: -1
  });

  assert.equal(result.status, 'DAILY_LOSS_GUARD_BLOCKED');
  assert.equal(result.operationalGate, 'BLOCKED');
  assert.ok(result.reasons.includes('invalid_bankroll'));
});

test('blocks live money invariant violations', () => {
  const result = new DailyLossGuardEngine().evaluate({
    bankroll: 100,
    dailyNetUnits: -1,
    productionMoneyAllowed: true,
    liveMoneyAuthorized: true
  });

  assert.equal(result.status, 'DAILY_LOSS_GUARD_BLOCKED');
  assert.equal(result.liveGate, 'BLOCKED');
  assert.equal(result.productionMoneyAllowed, false);
  assert.equal(result.liveMoneyAuthorized, false);
  assert.ok(result.reasons.includes('live_money_invariant_violation'));
});

test('rejects missing input safely', () => {
  const result = new DailyLossGuardEngine().evaluate(null);

  assert.equal(result.status, 'DAILY_LOSS_GUARD_BLOCKED');
  assert.equal(result.action, 'BLOCK_SESSION_UNTIL_REVIEW');
  assert.ok(result.reasons.includes('input_not_object'));
});

test('is deterministic and idempotent', () => {
  const engine = new DailyLossGuardEngine();
  const input = {
    bankroll: 100,
    dailyNetUnits: -2
  };

  assert.deepEqual(engine.evaluate(input), engine.evaluate(input));
});

test('validates configuration defensively', () => {
  assert.throws(
    () => new DailyLossGuardEngine({ defaultDailyLossPercent: 0 }),
    /defaultDailyLossPercent/
  );

  assert.throws(
    () => new DailyLossGuardEngine({
      defaultDailyLossPercent: 0.1,
      maxDailyLossPercent: 0.05
    }),
    /defaultDailyLossPercent/
  );

  assert.throws(
    () => new DailyLossGuardEngine({ warningUsageRatio: 1 }),
    /warningUsageRatio/
  );
});
