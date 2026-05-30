'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { StrategyResultLedgerEngine } = require('../../../src/domain/strategy/StrategyResultLedgerEngine');
const { MultiStrategyRuntimeCoordinator } = require('../../../src/domain/strategy/MultiStrategyRuntimeCoordinator');

function createLedger(strategyId, outcomes) {
  const ledgerEngine = new StrategyResultLedgerEngine();
  const created = ledgerEngine.createEmptyLedger(strategyId, 'paper-session-multi-strategy');

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

test('evaluates multiple strategies and orders execution before observe and blocked', () => {
  const coordinator = new MultiStrategyRuntimeCoordinator();

  const result = coordinator.evaluate({
    currentRoundIndex: 0,
    contextRecoveryScore: 1,
    tableContextScore: 0.9,
    operatorReadinessScore: 0.9,
    liveConsensusScore: 0.9,
    riskScore: 0.1,
    strategies: [
      {
        strategyId: 'fusion-reduzida',
        ledger: createLedger('fusion-reduzida', []),
        strategyDoctrineScore: 0.9,
        memoryTrustScore: 0.8
      },
      {
        strategyId: 'triplicacao',
        ledger: createLedger('triplicacao', []),
        strategyDoctrineScore: 0.1,
        memoryTrustScore: 0.5
      },
      {
        strategyId: 'estrategia-bloqueada',
        ledger: createLedger('estrategia-bloqueada', ['LOSS']),
        strategyDoctrineScore: 0.9,
        memoryTrustScore: 0.8
      }
    ]
  });

  assert.equal(result.status, 'MULTI_STRATEGY_RUNTIME_READY');
  assert.equal(result.totalStrategies, 3);
  assert.equal(result.executionAuthorizedCount, 1);
  assert.equal(result.observeCount, 1);
  assert.equal(result.blockedCount, 1);
  assert.equal(result.topStrategyId, 'fusion-reduzida');
  assert.equal(result.topAction, 'ENTRAR');
  assert.equal(result.results[0].displayAction, 'ENTRAR');
  assert.equal(result.results[1].displayAction, 'AGUARDAR');
  assert.equal(result.results[2].displayAction, 'NAO_UTILIZAR');
  assert.equal(result.liveGate, 'BLOCKED');
  assert.equal(result.productionMoneyAllowed, false);
  assert.equal(result.liveMoneyAuthorized, false);
});

test('blocks all strategies when supervisor veto is active', () => {
  const coordinator = new MultiStrategyRuntimeCoordinator();

  const result = coordinator.evaluate({
    currentRoundIndex: 0,
    contextRecoveryScore: 1,
    tableContextScore: 0.9,
    operatorReadinessScore: 0.9,
    liveConsensusScore: 0.9,
    riskScore: 0.1,
    supervisorVetoActive: true,
    strategies: [
      {
        strategyId: 'fusion-reduzida',
        ledger: createLedger('fusion-reduzida', []),
        strategyDoctrineScore: 0.9,
        memoryTrustScore: 0.8
      }
    ]
  });

  assert.equal(result.status, 'MULTI_STRATEGY_RUNTIME_READY');
  assert.equal(result.executionAuthorizedCount, 0);
  assert.equal(result.blockedCount, 1);
  assert.equal(result.results[0].displayAction, 'NAO_UTILIZAR');
  assert.equal(result.operationalGate, 'BLOCKED');
  assert.equal(result.paperGate, 'BLOCKED');
  assert.equal(result.liveGate, 'BLOCKED');
  assert.ok(result.reasons.includes('supervisor_veto_active'));
});

test('blocks safely when no strategies are registered', () => {
  const result = new MultiStrategyRuntimeCoordinator().evaluate({
    strategies: []
  });

  assert.equal(result.status, 'MULTI_STRATEGY_RUNTIME_BLOCKED');
  assert.equal(result.topAction, 'NAO_UTILIZAR');
  assert.ok(result.reasons.includes('no_strategies_registered'));
});

test('blocks safely when max strategy count is exceeded', () => {
  const coordinator = new MultiStrategyRuntimeCoordinator({ maxStrategies: 1 });

  const result = coordinator.evaluate({
    strategies: [
      { strategyId: 'fusion-reduzida', ledger: createLedger('fusion-reduzida', []) },
      { strategyId: 'triplicacao', ledger: createLedger('triplicacao', []) }
    ]
  });

  assert.equal(result.status, 'MULTI_STRATEGY_RUNTIME_BLOCKED');
  assert.ok(result.reasons.includes('max_strategies_exceeded'));
});

test('handles invalid strategy definitions without crashing', () => {
  const result = new MultiStrategyRuntimeCoordinator().evaluate({
    currentRoundIndex: 0,
    contextRecoveryScore: 1,
    tableContextScore: 0.9,
    operatorReadinessScore: 0.9,
    liveConsensusScore: 0.9,
    riskScore: 0.1,
    strategies: [null]
  });

  assert.equal(result.status, 'MULTI_STRATEGY_RUNTIME_READY');
  assert.equal(result.blockedCount, 1);
  assert.equal(result.results[0].strategyId, 'INVALID_0');
  assert.ok(result.reasons.includes('strategy_definition_invalid'));
});

test('blocks live money invariant violation from one strategy ledger', () => {
  const ledger = createLedger('fusion-reduzida', []);

  const result = new MultiStrategyRuntimeCoordinator().evaluate({
    currentRoundIndex: 0,
    contextRecoveryScore: 1,
    tableContextScore: 0.9,
    operatorReadinessScore: 0.9,
    liveConsensusScore: 0.9,
    riskScore: 0.1,
    strategies: [
      {
        strategyId: 'fusion-reduzida',
        ledger: {
          ...ledger,
          liveGate: 'OPEN',
          productionMoneyAllowed: true,
          liveMoneyAuthorized: true
        },
        strategyDoctrineScore: 0.9,
        memoryTrustScore: 0.8
      }
    ]
  });

  assert.equal(result.status, 'MULTI_STRATEGY_RUNTIME_READY');
  assert.equal(result.blockedCount, 1);
  assert.equal(result.results[0].displayAction, 'NAO_UTILIZAR');
  assert.equal(result.liveGate, 'BLOCKED');
  assert.equal(result.productionMoneyAllowed, false);
  assert.equal(result.liveMoneyAuthorized, false);
  assert.ok(result.reasons.includes('live_gate_must_remain_blocked'));
});

test('is deterministic and idempotent', () => {
  const coordinator = new MultiStrategyRuntimeCoordinator();
  const input = {
    currentRoundIndex: 0,
    contextRecoveryScore: 1,
    tableContextScore: 0.9,
    operatorReadinessScore: 0.9,
    liveConsensusScore: 0.9,
    riskScore: 0.1,
    strategies: [
      {
        strategyId: 'fusion-reduzida',
        ledger: createLedger('fusion-reduzida', []),
        strategyDoctrineScore: 0.9,
        memoryTrustScore: 0.8
      }
    ]
  };

  const first = coordinator.evaluate(input);
  const second = coordinator.evaluate(input);

  assert.deepEqual(first, second);
});

test('validates configuration defensively', () => {
  assert.throws(
    () => new MultiStrategyRuntimeCoordinator({ maxStrategies: 0 }),
    /maxStrategies/
  );
});
