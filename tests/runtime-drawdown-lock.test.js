const test = require('node:test');
const assert = require('node:assert');

const {
  RuntimeDrawdownLock
} = require('../dist/domain/runtime/RuntimeDrawdownLock');

function baseInput(overrides = {}) {
  return {
    initialBankroll: 240,
    currentBankroll: 240,
    peakBankroll: 240,
    previousBankroll: 240,
    elapsedWindowMs: 60000,
    absoluteStopLoss: 30,
    reviewDrawdownThreshold: 12,
    hardDrawdownThreshold: 24,
    maxLossVelocityPerMinute: 10,
    dataIntegrityValid: true,
    ...overrides
  };
}

test('RuntimeDrawdownLock returns OK for stable capital curve', () => {
  const engine = new RuntimeDrawdownLock();
  const result = engine.evaluate(baseInput());

  assert.equal(result.ok, true);
  assert.equal(result.value.status, 'DRAWDOWN_OK');
  assert.equal(result.value.reason, 'CAPITAL_CURVE_HEALTHY');
});

test('RuntimeDrawdownLock enters REVIEW for moderate drawdown', () => {
  const engine = new RuntimeDrawdownLock();
  const result = engine.evaluate(
    baseInput({
      currentBankroll: 226,
      peakBankroll: 240,
      previousBankroll: 228,
      elapsedWindowMs: 60000
    })
  );

  assert.equal(result.ok, true);
  assert.equal(result.value.status, 'DRAWDOWN_REVIEW');
  assert.equal(result.value.reason, 'DRAWDOWN_REVIEW_THRESHOLD_HIT');
});

test('RuntimeDrawdownLock locks on high loss velocity', () => {
  const engine = new RuntimeDrawdownLock();
  const result = engine.evaluate(
    baseInput({
      currentBankroll: 232,
      peakBankroll: 240,
      previousBankroll: 240,
      elapsedWindowMs: 30000
    })
  );

  assert.equal(result.ok, true);
  assert.equal(result.value.status, 'DRAWDOWN_LOCKED');
  assert.equal(result.value.reason, 'DRAWDOWN_VELOCITY_LOCK');
});

test('RuntimeDrawdownLock locks on absolute stop loss', () => {
  const engine = new RuntimeDrawdownLock();
  const result = engine.evaluate(
    baseInput({
      currentBankroll: 210,
      peakBankroll: 240,
      previousBankroll: 220
    })
  );

  assert.equal(result.ok, true);
  assert.equal(result.value.status, 'DRAWDOWN_LOCKED');
  assert.equal(result.value.reason, 'ABSOLUTE_STOP_LOSS_HIT');
});

test('RuntimeDrawdownLock blocks on data integrity failure', () => {
  const engine = new RuntimeDrawdownLock();
  const result = engine.evaluate(
    baseInput({
      dataIntegrityValid: false
    })
  );

  assert.equal(result.ok, true);
  assert.equal(result.value.status, 'BLOCKED');
  assert.equal(result.value.reason, 'DATA_INTEGRITY_FAILURE');
});

test('RuntimeDrawdownLock rejects malformed input without silent failure', () => {
  const engine = new RuntimeDrawdownLock();
  const result = engine.evaluate(
    baseInput({
      elapsedWindowMs: 0
    })
  );

  assert.equal(result.ok, false);
  assert.equal(result.error, 'INVALID_DRAWDOWN_INPUT');
});
