const test = require('node:test');
const assert = require('node:assert');

const {
  SessionCircuitBreaker
} = require('../dist/domain/runtime/SessionCircuitBreaker');

function baseInput(overrides = {}) {
  return {
    initialBankroll: 240,
    currentBankroll: 236,
    stopLossAmount: 30,
    stopWinAmount: 20,
    recentLossAmount: 4,
    recentWindowSpins: 8,
    maxRecentLossAmount: 14,
    runtimeSanityStatus: 'SANITY_OK',
    dataIntegrityOk: true,
    cooldownActive: false,
    ...overrides
  };
}

test(
  'SessionCircuitBreaker keeps session open inside risk budget',
  () => {
    const engine = new SessionCircuitBreaker();
    const result = engine.evaluate(baseInput());

    assert.equal(result.ok, true);
    assert.equal(result.value.status, 'SESSION_OPEN');
    assert.equal(result.value.locked, false);
    assert.equal(
      result.value.reason,
      'SESSION_WITHIN_RISK_BUDGET'
    );
  }
);

test(
  'SessionCircuitBreaker locks session when stop loss is reached',
  () => {
    const engine = new SessionCircuitBreaker();
    const result = engine.evaluate(
      baseInput({
        currentBankroll: 210
      })
    );

    assert.equal(result.ok, true);
    assert.equal(result.value.status, 'SESSION_LOCKED');
    assert.equal(result.value.locked, true);
    assert.equal(result.value.reason, 'STOP_LOSS_REACHED');
    assert.equal(result.value.requiresCooldown, true);
  }
);

test(
  'SessionCircuitBreaker locks profit when stop win is reached',
  () => {
    const engine = new SessionCircuitBreaker();
    const result = engine.evaluate(
      baseInput({
        currentBankroll: 260
      })
    );

    assert.equal(result.ok, true);
    assert.equal(
      result.value.status,
      'SESSION_PROFIT_LOCKED'
    );
    assert.equal(result.value.locked, true);
    assert.equal(result.value.reason, 'STOP_WIN_REACHED');
    assert.equal(result.value.requiresCooldown, false);
  }
);

test(
  'SessionCircuitBreaker reviews session on fast drawdown pressure',
  () => {
    const engine = new SessionCircuitBreaker();
    const result = engine.evaluate(
      baseInput({
        recentLossAmount: 14
      })
    );

    assert.equal(result.ok, true);
    assert.equal(result.value.status, 'SESSION_REVIEW');
    assert.equal(result.value.locked, false);
    assert.equal(result.value.reason, 'RISK_REVIEW_REQUIRED');
  }
);

test(
  'SessionCircuitBreaker locks session on runtime sanity break',
  () => {
    const engine = new SessionCircuitBreaker();
    const result = engine.evaluate(
      baseInput({
        runtimeSanityStatus: 'PARADIGM_BREAK'
      })
    );

    assert.equal(result.ok, true);
    assert.equal(result.value.status, 'SESSION_LOCKED');
    assert.equal(result.value.locked, true);
    assert.equal(result.value.reason, 'RUNTIME_SANITY_BREAK');
  }
);

test(
  'SessionCircuitBreaker locks session on data integrity failure',
  () => {
    const engine = new SessionCircuitBreaker();
    const result = engine.evaluate(
      baseInput({
        dataIntegrityOk: false
      })
    );

    assert.equal(result.ok, true);
    assert.equal(result.value.status, 'SESSION_LOCKED');
    assert.equal(result.value.locked, true);
    assert.equal(result.value.reason, 'DATA_INTEGRITY_FAILURE');
  }
);

test(
  'SessionCircuitBreaker rejects malformed input',
  () => {
    const engine = new SessionCircuitBreaker();
    const result = engine.evaluate(
      baseInput({
        initialBankroll: 0
      })
    );

    assert.equal(result.ok, false);
    assert.equal(
      result.error,
      'INVALID_CIRCUIT_BREAKER_INPUT'
    );
  }
);

test(
  'SessionCircuitBreaker is deterministic for repeated input',
  () => {
    const engine = new SessionCircuitBreaker();
