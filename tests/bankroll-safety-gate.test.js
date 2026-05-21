const test = require('node:test');
const assert = require('node:assert/strict');
const {
  OperatorRiskProfileCalculator,
  BankrollSafetyGate,
} = require('../dist/domain/risk');

function conservativeProfile() {
  return new OperatorRiskProfileCalculator().calculate({
    bankroll: 200,
    riskMode: 'CONSERVATIVE',
    allowMartingale: true,
  });
}

test('BankrollSafetyGate allows stake compatible with conservative profile', () => {
  const gate = new BankrollSafetyGate();
  const profile = conservativeProfile();

  const result = gate.evaluate({
    profile,
    currentBalance: 200,
    requestedStake: 2,
    currentSessionPnl: 0,
    martingaleStep: 0,
  });

  assert.equal(result.verdict, 'SAFE');
  assert.equal(result.allowedStake, 2);
  assert.equal(result.remainingLossBudget, 10);
  assert.equal(result.remainingProfitTarget, 16);
});

test('BankrollSafetyGate blocks when stop loss is reached', () => {
  const gate = new BankrollSafetyGate();
  const profile = conservativeProfile();

  const result = gate.evaluate({
    profile,
    currentBalance: 190,
    requestedStake: 2,
    currentSessionPnl: -10,
    martingaleStep: 0,
  });

  assert.equal(result.verdict, 'BLOCKED');
  assert.match(result.reason, /Stop loss/);
});

test('BankrollSafetyGate blocks when stop win is reached', () => {
  const gate = new BankrollSafetyGate();
  const profile = conservativeProfile();

  const result = gate.evaluate({
    profile,
    currentBalance: 216,
    requestedStake: 2,
    currentSessionPnl: 16,
    martingaleStep: 0,
  });

  assert.equal(result.verdict, 'BLOCKED');
  assert.match(result.reason, /Stop win/);
});

test('BankrollSafetyGate blocks exposure above max single exposure', () => {
  const gate = new BankrollSafetyGate();
  const profile = conservativeProfile();

  const result = gate.evaluate({
    profile,
    currentBalance: 200,
    requestedStake: 20,
    currentSessionPnl: 0,
    martingaleStep: 0,
  });

  assert.equal(result.verdict, 'BLOCKED');
  assert.match(result.reason, /exposição/);
  assert.equal(result.allowedStake, 6);
});

test('BankrollSafetyGate blocks unsafe martingale step', () => {
  const gate = new BankrollSafetyGate();
  const profile = conservativeProfile();

  const result = gate.evaluate({
    profile,
    currentBalance: 200,
    requestedStake: 2,
    currentSessionPnl: 0,
    martingaleStep: 2,
  });

  assert.equal(result.verdict, 'BLOCKED');
  assert.match(result.reason, /Martingale/);
});

test('BankrollSafetyGate asks review for stake above base but inside limits', () => {
  const gate = new BankrollSafetyGate();
  const profile = conservativeProfile();

  const result = gate.evaluate({
    profile,
    currentBalance: 200,
    requestedStake: 4,
    currentSessionPnl: 0,
    martingaleStep: 0,
  });

  assert.equal(result.verdict, 'REVIEW');
  assert.match(result.reason, /acima da base/);
});

test('BankrollSafetyGate rejects invalid requested stake', () => {
  const gate = new BankrollSafetyGate();
  const profile = conservativeProfile();

  assert.throws(() => gate.evaluate({
    profile,
    currentBalance: 200,
    requestedStake: 0,
    currentSessionPnl: 0,
    martingaleStep: 0,
  }), /requestedStake/);
});
