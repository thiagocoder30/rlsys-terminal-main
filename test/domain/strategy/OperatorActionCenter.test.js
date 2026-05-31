'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { StrategyResultLedgerEngine } = require('../../../src/domain/strategy/StrategyResultLedgerEngine');
const { MultiStrategyRuntimeCoordinator } = require('../../../src/domain/strategy/MultiStrategyRuntimeCoordinator');
const { StrategyDashboardEngine } = require('../../../src/domain/strategy/StrategyDashboardEngine');
const { OperatorActionCenter } = require('../../../src/domain/strategy/OperatorActionCenter');

function createLedger(strategyId, outcomes) {
  const ledgerEngine = new StrategyResultLedgerEngine();
  const created = ledgerEngine.createEmptyLedger(strategyId, 'paper-session-action-center');

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

function createDashboard(mode) {
  const strong = mode === 'strong';
  const observe = mode === 'observe';
  const blocked = mode === 'blocked';

  const runtime = new MultiStrategyRuntimeCoordinator().evaluate({
    currentRoundIndex: blocked ? 1 : 0,
    contextRecoveryScore: 1,
    tableContextScore: strong ? 0.9 : 0.7,
    operatorReadinessScore: strong ? 0.9 : 0.7,
    liveConsensusScore: strong ? 0.9 : 0.65,
    riskScore: strong ? 0.1 : 0.25,
    strategies: [
      {
        strategyId: 'fusion-reduzida',
        ledger: createLedger('fusion-reduzida', blocked ? ['LOSS'] : []),
        strategyDoctrineScore: strong ? 0.9 : 0.1,
        memoryTrustScore: strong ? 0.8 : 0.5
      }
    ]
  });

  if (observe) {
    assert.equal(runtime.topAction, 'AGUARDAR');
  }

  return new StrategyDashboardEngine().compose({
    multiStrategyRuntime: runtime
  });
}

test('returns ENTRAR when dashboard has execution authorized strategy', () => {
  const dashboard = createDashboard('strong');
  const action = new OperatorActionCenter().decide({
    dashboard
  });

  assert.equal(action.status, 'OPERATOR_ACTION_READY');
  assert.equal(action.operatorAction, 'ENTRAR');
  assert.equal(action.userAction, 'ENTRAR');
  assert.equal(action.selectedStrategyId, 'fusion-reduzida');
  assert.equal(action.paperGate, 'PAPER_AUTHORIZED');
  assert.equal(action.liveGate, 'BLOCKED');
  assert.equal(action.productionMoneyAllowed, false);
  assert.equal(action.liveMoneyAuthorized, false);
});

test('returns AGUARDAR when dashboard is observation mode', () => {
  const dashboard = createDashboard('observe');
  const action = new OperatorActionCenter().decide({
    dashboard
  });

  assert.equal(action.status, 'OPERATOR_ACTION_WAIT');
  assert.equal(action.operatorAction, 'AGUARDAR');
  assert.equal(action.userAction, 'AGUARDAR');
  assert.equal(action.paperGate, 'PAPER_AUTHORIZED');
  assert.equal(action.liveGate, 'BLOCKED');
});

test('returns NAO_UTILIZAR when top strategy is blocked', () => {
  const dashboard = createDashboard('blocked');
  const action = new OperatorActionCenter().decide({
    dashboard
  });

  assert.equal(action.status, 'OPERATOR_ACTION_BLOCKED');
  assert.equal(action.operatorAction, 'NAO_UTILIZAR');
  assert.equal(action.userAction, 'NAO_UTILIZAR');
  assert.equal(action.liveGate, 'BLOCKED');
});

test('blocks action when supervisor veto is active', () => {
  const dashboard = createDashboard('strong');
  const action = new OperatorActionCenter().decide({
    dashboard,
    supervisorVetoActive: true
  });

  assert.equal(action.status, 'OPERATOR_ACTION_BLOCKED');
  assert.equal(action.operatorAction, 'NAO_UTILIZAR');
  assert.equal(action.paperGate, 'BLOCKED');
  assert.ok(action.reasons.includes('supervisor_veto_active'));
});

test('blocks action when dashboard invariant is violated', () => {
  const dashboard = createDashboard('strong');
  const action = new OperatorActionCenter().decide({
    dashboard: {
      ...dashboard,
      liveGate: 'OPEN',
      productionMoneyAllowed: true,
      liveMoneyAuthorized: true
    }
  });

  assert.equal(action.status, 'OPERATOR_ACTION_BLOCKED');
  assert.equal(action.operatorAction, 'NAO_UTILIZAR');
  assert.equal(action.liveGate, 'BLOCKED');
  assert.equal(action.productionMoneyAllowed, false);
  assert.equal(action.liveMoneyAuthorized, false);
  assert.ok(action.reasons.includes('dashboard_live_gate_must_remain_blocked'));
});

test('rejects missing input safely', () => {
  const action = new OperatorActionCenter().decide(null);

  assert.equal(action.status, 'OPERATOR_ACTION_BLOCKED');
  assert.equal(action.operatorAction, 'NAO_UTILIZAR');
  assert.ok(action.reasons.includes('input_not_object'));
});

test('is deterministic and idempotent', () => {
  const dashboard = createDashboard('strong');
  const center = new OperatorActionCenter();
  const input = { dashboard };

  const first = center.decide(input);
  const second = center.decide(input);

  assert.deepEqual(first, second);
});
