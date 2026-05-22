const test = require('node:test');
const assert = require('node:assert/strict');
const {
  BankrollHudSnapshotComposer,
} = require('../dist/application/operator');
const {
  RuntimeRiskDecisionGateway,
} = require('../dist/application/runtime');
const {
  OperatorRiskProfileCalculator,
} = require('../dist/domain/risk');

function profile() {
  return new OperatorRiskProfileCalculator().calculate({
    bankroll: 200,
    riskMode: 'CONSERVATIVE',
    allowMartingale: true,
  });
}

test('BankrollHudSnapshotComposer creates financial HUD snapshot', () => {
  const p = profile();
  const decision = new RuntimeRiskDecisionGateway().evaluate({
    profile: p,
    commandType: 'ROUND',
    currentBalance: 200,
    requestedStake: 2,
    currentSessionPnl: 0,
    martingaleStep: 0,
    nowEpochMs: 1000,
  });

  const composer = new BankrollHudSnapshotComposer();
  const snapshot = composer.compose({
    profile: p,
    currentBalance: 200,
    currentSessionPnl: 0,
    riskDecision: decision,
  });

  assert.equal(snapshot.bankroll, 200);
  assert.equal(snapshot.baseStake, 2);
  assert.equal(snapshot.dailyStopWin, 16);
  assert.equal(snapshot.dailyStopLoss, 10);
  assert.equal(snapshot.riskVerdict, 'RISK_ALLOW');
  assert.equal(snapshot.profitState, 'PROFIT_OPEN');
  assert.equal(snapshot.cooldownState, 'COOLDOWN_CLEAR');
});

test('BankrollHudSnapshotComposer renders human-readable HUD', () => {
  const p = profile();
  const decision = new RuntimeRiskDecisionGateway().evaluate({
    profile: p,
    commandType: 'ROUND',
    currentBalance: 212,
    requestedStake: 2,
    currentSessionPnl: 12,
    martingaleStep: 0,
    nowEpochMs: 1000,
  });

  const composer = new BankrollHudSnapshotComposer();
  const snapshot = composer.compose({
    profile: p,
    currentBalance: 212,
    currentSessionPnl: 12,
    riskDecision: decision,
  });

  const rendered = composer.render(snapshot);

  assert.match(rendered, /RL\.SYS BANKROLL HUD/);
  assert.match(rendered, /Saldo atual/);
  assert.match(rendered, /Stop Win/);
  assert.match(rendered, /RISK_REVIEW/);
  assert.match(rendered, /PROFIT_PROTECT/);
});

test('BankrollHudSnapshotComposer rejects invalid balance', () => {
  const p = profile();
  const decision = new RuntimeRiskDecisionGateway().evaluate({
    profile: p,
    commandType: 'ROUND',
    currentBalance: 200,
    requestedStake: 2,
    currentSessionPnl: 0,
    martingaleStep: 0,
    nowEpochMs: 1000,
  });

  const composer = new BankrollHudSnapshotComposer();

  assert.throws(() => composer.compose({
    profile: p,
    currentBalance: -1,
    currentSessionPnl: 0,
    riskDecision: decision,
  }), /currentBalance/);
});
