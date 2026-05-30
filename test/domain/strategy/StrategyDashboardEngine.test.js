'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { StrategyResultLedgerEngine } = require('../../../src/domain/strategy/StrategyResultLedgerEngine');
const { MultiStrategyRuntimeCoordinator } = require('../../../src/domain/strategy/MultiStrategyRuntimeCoordinator');
const { StrategyDashboardEngine } = require('../../../src/domain/strategy/StrategyDashboardEngine');

function createLedger(strategyId, outcomes) {
  const ledgerEngine = new StrategyResultLedgerEngine();
  const created = ledgerEngine.createEmptyLedger(strategyId, 'paper-session-dashboard');

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

function createRuntime() {
  return new MultiStrategyRuntimeCoordinator().evaluate({
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
        strategyId: 'bloqueada',
        ledger: createLedger('bloqueada', ['LOSS']),
        strategyDoctrineScore: 0.9,
        memoryTrustScore: 0.8
      }
    ]
  });
}

test('composes dashboard from multi strategy runtime', () => {
  const runtime = createRuntime();
  const dashboard = new StrategyDashboardEngine().compose({
    multiStrategyRuntime: runtime
  });

  assert.equal(dashboard.status, 'STRATEGY_DASHBOARD_READY');
  assert.equal(dashboard.sessionStatus, 'ACTION_AVAILABLE');
  assert.equal(dashboard.executionAuthorizedCount, 1);
  assert.equal(dashboard.observeCount, 1);
  assert.equal(dashboard.blockedCount, 1);
  assert.equal(dashboard.visibleStrategies, 3);
  assert.equal(dashboard.cards[0].displayAction, 'ENTRAR');
  assert.ok(dashboard.rendered.includes('Live Money: BLOQUEADO'));
  assert.equal(dashboard.liveGate, 'BLOCKED');
  assert.equal(dashboard.productionMoneyAllowed, false);
  assert.equal(dashboard.liveMoneyAuthorized, false);
});

test('limits visible strategies without mutating runtime', () => {
  const runtime = createRuntime();
  const dashboard = new StrategyDashboardEngine({ maxVisibleStrategies: 2 }).compose({
    multiStrategyRuntime: runtime
  });

  assert.equal(dashboard.status, 'STRATEGY_DASHBOARD_READY');
  assert.equal(dashboard.totalStrategies, 3);
  assert.equal(dashboard.visibleStrategies, 2);
  assert.equal(runtime.results.length, 3);
});

test('renders observation mode when there is no authorized execution', () => {
  const runtime = new MultiStrategyRuntimeCoordinator().evaluate({
    currentRoundIndex: 0,
    contextRecoveryScore: 1,
    tableContextScore: 0.7,
    operatorReadinessScore: 0.7,
    liveConsensusScore: 0.65,
    riskScore: 0.25,
    strategies: [
      {
        strategyId: 'triplicacao',
        ledger: createLedger('triplicacao', []),
        strategyDoctrineScore: 0.1,
        memoryTrustScore: 0.5
      }
    ]
  });

  const dashboard = new StrategyDashboardEngine().compose({
    multiStrategyRuntime: runtime
  });

  assert.equal(dashboard.sessionStatus, 'OBSERVATION_MODE');
  assert.equal(dashboard.topAction, 'AGUARDAR');
  assert.ok(dashboard.headline.includes('Manter observação'));
});

test('renders session blocked when runtime gates are blocked', () => {
  const runtime = new MultiStrategyRuntimeCoordinator().evaluate({
    supervisorVetoActive: true,
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
  });

  const dashboard = new StrategyDashboardEngine().compose({
    multiStrategyRuntime: runtime
  });

  assert.equal(dashboard.sessionStatus, 'SESSION_BLOCKED');
  assert.equal(dashboard.paperGate, 'BLOCKED');
  assert.equal(dashboard.liveGate, 'BLOCKED');
});

test('blocks dashboard on invariant violation', () => {
  const runtime = {
    ...createRuntime(),
    liveGate: 'OPEN',
    productionMoneyAllowed: true,
    liveMoneyAuthorized: true
  };

  const dashboard = new StrategyDashboardEngine().compose({
    multiStrategyRuntime: runtime
  });

  assert.equal(dashboard.status, 'STRATEGY_DASHBOARD_BLOCKED');
  assert.equal(dashboard.paperGate, 'BLOCKED');
  assert.equal(dashboard.liveGate, 'BLOCKED');
  assert.equal(dashboard.productionMoneyAllowed, false);
  assert.equal(dashboard.liveMoneyAuthorized, false);
  assert.ok(dashboard.reasons.includes('runtime_live_gate_must_remain_blocked'));
});

test('rejects missing input safely', () => {
  const dashboard = new StrategyDashboardEngine().compose(null);

  assert.equal(dashboard.status, 'STRATEGY_DASHBOARD_BLOCKED');
  assert.equal(dashboard.paperGate, 'BLOCKED');
  assert.ok(dashboard.reasons.includes('input_not_object'));
});

test('is deterministic and idempotent', () => {
  const runtime = createRuntime();
  const engine = new StrategyDashboardEngine();
  const input = {
    multiStrategyRuntime: runtime
  };

  const first = engine.compose(input);
  const second = engine.compose(input);

  assert.deepEqual(first, second);
});

test('validates configuration defensively', () => {
  assert.throws(
    () => new StrategyDashboardEngine({ maxVisibleStrategies: 0 }),
    /maxVisibleStrategies/
  );
});
