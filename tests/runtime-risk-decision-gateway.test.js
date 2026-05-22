const test = require('node:test');
const assert = require('node:assert/strict');
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

test('RuntimeRiskDecisionGateway allows healthy operation', () => {
  const gateway = new RuntimeRiskDecisionGateway();

  const result = gateway.evaluate({
    profile: profile(),
    commandType: 'ROUND',
    currentBalance: 200,
    requestedStake: 2,
    currentSessionPnl: 0,
    martingaleStep: 0,
    nowEpochMs: 1000,
  });

  assert.equal(result.verdict, 'RISK_ALLOW');
  assert.equal(result.bankroll.verdict, 'SAFE');
  assert.equal(result.profit.state, 'PROFIT_OPEN');
  assert.equal(result.cooldown.verdict, 'ALLOW');
});

test('RuntimeRiskDecisionGateway blocks stop loss', () => {
  const gateway = new RuntimeRiskDecisionGateway();

  const result = gateway.evaluate({
    profile: profile(),
    commandType: 'ROUND',
    currentBalance: 190,
    requestedStake: 2,
    currentSessionPnl: -10,
    martingaleStep: 0,
    nowEpochMs: 1000,
  });

  assert.equal(result.verdict, 'RISK_BLOCK');
  assert.match(result.reason, /Stop loss/);
  assert.equal(result.guidance.severity, 'STOP');
});

test('RuntimeRiskDecisionGateway blocks stop win via conscious profit mode', () => {
  const gateway = new RuntimeRiskDecisionGateway();

  const result = gateway.evaluate({
    profile: profile(),
    commandType: 'ROUND',
    currentBalance: 216,
    requestedStake: 2,
    currentSessionPnl: 16,
    martingaleStep: 0,
    nowEpochMs: 1000,
  });

  assert.equal(result.verdict, 'RISK_BLOCK');
  assert.equal(result.profit.state, 'PROFIT_LOCKED');
});

test('RuntimeRiskDecisionGateway reviews near profit target', () => {
  const gateway = new RuntimeRiskDecisionGateway();

  const result = gateway.evaluate({
    profile: profile(),
    commandType: 'ROUND',
    currentBalance: 212,
    requestedStake: 2,
    currentSessionPnl: 12,
    martingaleStep: 0,
    nowEpochMs: 1000,
  });

  assert.equal(result.verdict, 'RISK_REVIEW');
  assert.equal(result.profit.state, 'PROFIT_PROTECT');
});

test('RuntimeRiskDecisionGateway blocks emotional cooldown after losses', () => {
  const gateway = new RuntimeRiskDecisionGateway();
  const p = profile();

  gateway.evaluate({
    profile: p,
    commandType: 'LOSS',
    currentBalance: 198,
    requestedStake: 2,
    currentSessionPnl: -2,
    martingaleStep: 0,
    nowEpochMs: 1000,
  });

  gateway.evaluate({
    profile: p,
    commandType: 'LOSS',
    currentBalance: 196,
    requestedStake: 2,
    currentSessionPnl: -4,
    martingaleStep: 0,
    nowEpochMs: 2000,
  });

  const result = gateway.evaluate({
    profile: p,
    commandType: 'LOSS',
    currentBalance: 194,
    requestedStake: 2,
    currentSessionPnl: -6,
    martingaleStep: 0,
    nowEpochMs: 3000,
  });

  assert.equal(result.verdict, 'RISK_BLOCK');
  assert.equal(result.cooldown.verdict, 'BLOCK');
});

test('RuntimeRiskDecisionGateway rejects invalid stake', () => {
  const gateway = new RuntimeRiskDecisionGateway();

  assert.throws(() => gateway.evaluate({
    profile: profile(),
    commandType: 'ROUND',
    currentBalance: 200,
    requestedStake: 0,
    currentSessionPnl: 0,
    martingaleStep: 0,
    nowEpochMs: 1000,
  }), /requestedStake/);
});
