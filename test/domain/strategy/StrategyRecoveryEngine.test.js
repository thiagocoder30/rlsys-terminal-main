'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { StrategyResultLedgerEngine } = require('../../../src/domain/strategy/StrategyResultLedgerEngine');
const { StrategyCooldownEngine } = require('../../../src/domain/strategy/StrategyCooldownEngine');
const { StrategyRecoveryEngine } = require('../../../src/domain/strategy/StrategyRecoveryEngine');

function createLedger(outcomes) {
  const ledgerEngine = new StrategyResultLedgerEngine();
  const created = ledgerEngine.createEmptyLedger('fusion-reduzida', 'paper-session-recovery');

  assert.equal(created.ok, true);

  let ledger = created.value;

  for (let index = 0; index < outcomes.length; index += 1) {
    const result = ledgerEngine.appendResult({
      ledger,
      outcome: outcomes[index],
      roundIndex: index + 1
    });

    assert.equal(result.status, 'STRATEGY_RESULT_RECORDED');
    ledger = result.ledger;
  }

  return ledger;
}

test('waits while strategy cooldown is still active', () => {
  const ledger = createLedger(['LOSS']);
  const cooldown = new StrategyCooldownEngine({ baseCooldownRounds: 3 }).evaluate({
    ledger,
    currentRoundIndex: 1
  });

  const recovery = new StrategyRecoveryEngine().evaluate({
    ledger,
    cooldownDecision: cooldown,
    contextRecoveryScore: 0.9,
    riskScore: 0.1
  });

  assert.equal(recovery.status, 'STRATEGY_RECOVERY_WAIT_COOLDOWN');
  assert.equal(recovery.strategyRecovered, false);
  assert.equal(recovery.action, 'WAIT_COOLDOWN');
  assert.equal(recovery.remainingRounds, 3);
  assert.equal(recovery.paperGate, 'PAPER_AUTHORIZED');
  assert.equal(recovery.liveGate, 'BLOCKED');
});

test('waits for context recovery after cooldown elapsed when context is weak', () => {
  const ledger = createLedger(['LOSS']);
  const cooldown = new StrategyCooldownEngine({ baseCooldownRounds: 3 }).evaluate({
    ledger,
    currentRoundIndex: 4
  });

  const recovery = new StrategyRecoveryEngine({ minRecoveryContextScore: 0.7 }).evaluate({
    ledger,
    cooldownDecision: cooldown,
    contextRecoveryScore: 0.4,
    riskScore: 0.1
  });

  assert.equal(cooldown.status, 'STRATEGY_REVIEW_REQUIRED');
  assert.equal(recovery.status, 'STRATEGY_RECOVERY_WAIT_CONTEXT');
  assert.equal(recovery.action, 'WAIT_FOR_RECOVERY');
  assert.ok(recovery.reasons.includes('context_recovery_below_minimum'));
});

test('approves strategy recovery when cooldown elapsed and context recovered', () => {
  const ledger = createLedger(['LOSS']);
  const cooldown = new StrategyCooldownEngine({ baseCooldownRounds: 3 }).evaluate({
    ledger,
    currentRoundIndex: 4
  });

  const recovery = new StrategyRecoveryEngine({ minRecoveryContextScore: 0.7 }).evaluate({
    ledger,
    cooldownDecision: cooldown,
    contextRecoveryScore: 0.82,
    riskScore: 0.1
  });

  assert.equal(recovery.status, 'STRATEGY_RECOVERY_APPROVED');
  assert.equal(recovery.strategyRecovered, true);
  assert.equal(recovery.strategyAvailableForEvaluation, true);
  assert.equal(recovery.action, 'ALLOW_STRATEGY_REEVALUATION');
  assert.equal(recovery.strategyGate, 'RECOVERED');
});

test('blocks recovery when cooldown engine hard blocks strategy', () => {
  const ledger = createLedger(['LOSS', 'LOSS', 'LOSS']);
  const cooldown = new StrategyCooldownEngine({ hardBlockLossStreak: 3 }).evaluate({
    ledger,
    currentRoundIndex: 3
  });

  const recovery = new StrategyRecoveryEngine().evaluate({
    ledger,
    cooldownDecision: cooldown,
    contextRecoveryScore: 1,
    riskScore: 0.1
  });

  assert.equal(cooldown.status, 'STRATEGY_BLOCKED');
  assert.equal(recovery.status, 'STRATEGY_RECOVERY_BLOCKED');
  assert.equal(recovery.strategyGate, 'BLOCKED');
});

test('blocks recovery when supervisor veto is active', () => {
  const ledger = createLedger(['LOSS']);
  const cooldown = new StrategyCooldownEngine({ baseCooldownRounds: 3 }).evaluate({
    ledger,
    currentRoundIndex: 4
  });

  const recovery = new StrategyRecoveryEngine().evaluate({
    ledger,
    cooldownDecision: cooldown,
    contextRecoveryScore: 0.9,
    riskScore: 0.1,
    supervisorVetoActive: true
  });

  assert.equal(recovery.status, 'STRATEGY_RECOVERY_BLOCKED');
  assert.ok(recovery.reasons.includes('supervisor_veto_active'));
});

test('blocks recovery when risk remains above limit', () => {
  const ledger = createLedger(['LOSS']);
  const cooldown = new StrategyCooldownEngine({ baseCooldownRounds: 3 }).evaluate({
    ledger,
    currentRoundIndex: 4
  });

  const recovery = new StrategyRecoveryEngine({ maxAllowedRiskScore: 0.3 }).evaluate({
    ledger,
    cooldownDecision: cooldown,
    contextRecoveryScore: 0.9,
    riskScore: 0.8
  });

  assert.equal(recovery.status, 'STRATEGY_RECOVERY_BLOCKED');
  assert.ok(recovery.reasons.includes('risk_above_recovery_limit'));
});

test('blocks invariant violations defensively', () => {
  const ledger = createLedger(['LOSS']);
  const cooldown = new StrategyCooldownEngine({ baseCooldownRounds: 3 }).evaluate({
    ledger,
    currentRoundIndex: 4
  });

  const recovery = new StrategyRecoveryEngine().evaluate({
    ledger: {
      ...ledger,
      liveGate: 'OPEN',
      productionMoneyAllowed: true,
      liveMoneyAuthorized: true
    },
    cooldownDecision: cooldown,
    contextRecoveryScore: 0.9,
    riskScore: 0.1
  });

  assert.equal(recovery.status, 'STRATEGY_RECOVERY_BLOCKED');
  assert.equal(recovery.liveGate, 'BLOCKED');
  assert.equal(recovery.productionMoneyAllowed, false);
  assert.equal(recovery.liveMoneyAuthorized, false);
  assert.ok(recovery.reasons.includes('ledger_live_gate_must_remain_blocked'));
});

test('is deterministic and idempotent', () => {
  const ledger = createLedger(['LOSS']);
  const cooldown = new StrategyCooldownEngine({ baseCooldownRounds: 3 }).evaluate({
    ledger,
    currentRoundIndex: 4
  });

  const engine = new StrategyRecoveryEngine();
  const input = {
    ledger,
    cooldownDecision: cooldown,
    contextRecoveryScore: 0.9,
    riskScore: 0.1
  };

  const first = engine.evaluate(input);
  const second = engine.evaluate(input);

  assert.deepEqual(first, second);
});

test('validates configuration defensively', () => {
  assert.throws(
    () => new StrategyRecoveryEngine({ minRecoveryContextScore: 2 }),
    /minRecoveryContextScore/
  );

  assert.throws(
    () => new StrategyRecoveryEngine({ maxAllowedRiskScore: -1 }),
    /maxAllowedRiskScore/
  );
});
