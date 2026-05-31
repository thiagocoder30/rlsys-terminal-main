'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { StrategyResultLedgerEngine } = require('../../../src/domain/strategy/StrategyResultLedgerEngine');
const { StrategyCooldownEngine } = require('../../../src/domain/strategy/StrategyCooldownEngine');
const { StrategyRecoveryEngine } = require('../../../src/domain/strategy/StrategyRecoveryEngine');
const { StrategyCooldownVisualizer } = require('../../../src/domain/strategy/StrategyCooldownVisualizer');

function createLedger(outcomes) {
  const ledgerEngine = new StrategyResultLedgerEngine();
  const created = ledgerEngine.createEmptyLedger('fusion-reduzida', 'paper-session-cooldown-visual');
  assert.equal(created.ok, true);

  let ledger = created.value;
  for (let index = 0; index < outcomes.length; index += 1) {
    const result = ledgerEngine.appendResult({ ledger, outcome: outcomes[index], roundIndex: index + 1 });
    assert.equal(result.status, 'STRATEGY_RESULT_RECORDED');
    ledger = result.ledger;
  }

  return ledger;
}

test('visualizes active cooldown with remaining rounds', () => {
  const ledger = createLedger(['LOSS']);
  const cooldown = new StrategyCooldownEngine({ baseCooldownRounds: 3 }).evaluate({ ledger, currentRoundIndex: 1 });
  const recovery = new StrategyRecoveryEngine().evaluate({ ledger, cooldownDecision: cooldown, contextRecoveryScore: 1, riskScore: 0.1 });
  const visual = new StrategyCooldownVisualizer().visualize({ cooldownDecision: cooldown, recoveryDecision: recovery });

  assert.equal(visual.status, 'STRATEGY_COOLDOWN_VISUAL_READY');
  assert.equal(visual.displayStatus, 'COOLDOWN');
  assert.equal(visual.displayAction, 'AGUARDAR_COOLDOWN');
  assert.equal(visual.remainingRounds, 3);
  assert.equal(visual.progressPercent, 0);
  assert.equal(visual.severity, 'WARNING');
  assert.equal(visual.liveGate, 'BLOCKED');
  assert.equal(visual.productionMoneyAllowed, false);
  assert.equal(visual.liveMoneyAuthorized, false);
});

test('visualizes cooldown progress as rounds advance', () => {
  const ledger = createLedger(['LOSS']);
  const cooldown = new StrategyCooldownEngine({ baseCooldownRounds: 4 }).evaluate({ ledger, currentRoundIndex: 3 });
  const recovery = new StrategyRecoveryEngine().evaluate({ ledger, cooldownDecision: cooldown, contextRecoveryScore: 1, riskScore: 0.1 });
  const visual = new StrategyCooldownVisualizer().visualize({ cooldownDecision: cooldown, recoveryDecision: recovery });

  assert.equal(visual.displayStatus, 'COOLDOWN');
  assert.equal(visual.remainingRounds, 2);
  assert.equal(visual.progressPercent, 50);
});

test('visualizes review required after cooldown elapsed', () => {
  const ledger = createLedger(['LOSS']);
  const cooldown = new StrategyCooldownEngine({ baseCooldownRounds: 3 }).evaluate({ ledger, currentRoundIndex: 4 });
  const recovery = new StrategyRecoveryEngine({ minRecoveryContextScore: 0.8 }).evaluate({ ledger, cooldownDecision: cooldown, contextRecoveryScore: 0.5, riskScore: 0.1 });
  const visual = new StrategyCooldownVisualizer().visualize({ cooldownDecision: cooldown, recoveryDecision: recovery });

  assert.equal(visual.displayStatus, 'REVISAO');
  assert.equal(visual.displayAction, 'AGUARDAR_RECUPERACAO');
  assert.equal(visual.strategyGate, 'REVIEW_REQUIRED');
  assert.ok(visual.reasons.includes('context_recovery_below_minimum'));
});

test('visualizes recovered state', () => {
  const ledger = createLedger(['LOSS']);
  const cooldown = new StrategyCooldownEngine({ baseCooldownRounds: 3 }).evaluate({ ledger, currentRoundIndex: 4 });
  const recovery = new StrategyRecoveryEngine({ minRecoveryContextScore: 0.8 }).evaluate({ ledger, cooldownDecision: cooldown, contextRecoveryScore: 0.9, riskScore: 0.1 });
  const visual = new StrategyCooldownVisualizer().visualize({ cooldownDecision: cooldown, recoveryDecision: recovery });

  assert.equal(recovery.status, 'STRATEGY_RECOVERY_APPROVED');
  assert.equal(visual.displayStatus, 'RECUPERADO');
  assert.equal(visual.displayAction, 'LIBERADO_PARA_REAVALIACAO');
  assert.equal(visual.strategyGate, 'RECOVERED');
  assert.equal(visual.progressPercent, 100);
  assert.equal(visual.severity, 'INFO');
});

test('visualizes hard block defensively', () => {
  const ledger = createLedger(['LOSS', 'LOSS', 'LOSS']);
  const cooldown = new StrategyCooldownEngine({ hardBlockLossStreak: 3 }).evaluate({ ledger, currentRoundIndex: 3 });
  const recovery = new StrategyRecoveryEngine().evaluate({ ledger, cooldownDecision: cooldown, contextRecoveryScore: 1, riskScore: 0.1 });
  const visual = new StrategyCooldownVisualizer().visualize({ cooldownDecision: cooldown, recoveryDecision: recovery });

  assert.equal(visual.displayStatus, 'BLOQUEADO');
  assert.equal(visual.displayAction, 'NAO_UTILIZAR');
  assert.equal(visual.severity, 'CRITICAL');
  assert.equal(visual.strategyGate, 'BLOCKED');
});

test('blocks visual on invariant violation', () => {
  const ledger = createLedger(['LOSS']);
  const cooldown = new StrategyCooldownEngine({ baseCooldownRounds: 3 }).evaluate({ ledger, currentRoundIndex: 1 });
  const recovery = new StrategyRecoveryEngine().evaluate({ ledger, cooldownDecision: cooldown, contextRecoveryScore: 1, riskScore: 0.1 });
  const visual = new StrategyCooldownVisualizer().visualize({
    cooldownDecision: { ...cooldown, liveGate: 'OPEN', productionMoneyAllowed: true, liveMoneyAuthorized: true },
    recoveryDecision: recovery
  });

  assert.equal(visual.status, 'STRATEGY_COOLDOWN_VISUAL_BLOCKED');
  assert.equal(visual.paperGate, 'BLOCKED');
  assert.equal(visual.liveGate, 'BLOCKED');
  assert.equal(visual.productionMoneyAllowed, false);
  assert.equal(visual.liveMoneyAuthorized, false);
  assert.ok(visual.reasons.includes('cooldown_live_gate_must_remain_blocked'));
});

test('rejects missing input safely', () => {
  const visual = new StrategyCooldownVisualizer().visualize(null);
  assert.equal(visual.status, 'STRATEGY_COOLDOWN_VISUAL_BLOCKED');
  assert.equal(visual.displayAction, 'NAO_UTILIZAR');
  assert.ok(visual.reasons.includes('input_not_object'));
});

test('is deterministic and idempotent', () => {
  const ledger = createLedger(['LOSS']);
  const cooldown = new StrategyCooldownEngine({ baseCooldownRounds: 3 }).evaluate({ ledger, currentRoundIndex: 1 });
  const recovery = new StrategyRecoveryEngine().evaluate({ ledger, cooldownDecision: cooldown, contextRecoveryScore: 1, riskScore: 0.1 });
  const engine = new StrategyCooldownVisualizer();
  const input = { cooldownDecision: cooldown, recoveryDecision: recovery };

  assert.deepEqual(engine.visualize(input), engine.visualize(input));
});
