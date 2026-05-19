const test = require('node:test');
const assert = require('node:assert');

const {
  RuntimeEnforcementOrchestrator
} = require('../dist/domain/runtime/RuntimeEnforcementOrchestrator');

function baseInput(overrides = {}) {
  return {
    dataIntegrityValid: true,
    runtimeSanityState: 'SANITY_OK',
    sessionBreakerState: 'SESSION_OPEN',
    drawdownLockState: 'DRAWDOWN_OK',
    runtimeHealthState: 'HEALTHY',
    cooldownActive: false,
    financialExposureAllowed: true,
    candidateAvailable: true,
    ...overrides
  };
}

test('RuntimeEnforcementOrchestrator allows only when all guards allow', () => {
  const result = new RuntimeEnforcementOrchestrator().evaluate(baseInput());

  assert.equal(result.ok, true);
  assert.equal(result.value.verdict, 'ALLOW');
  assert.equal(result.value.allowed, true);
  assert.deepEqual(result.value.reasons, ['ALL_GUARDS_ALLOW']);
});

test('RuntimeEnforcementOrchestrator blocks invalid data before all other guards', () => {
  const result = new RuntimeEnforcementOrchestrator().evaluate(
    baseInput({
      dataIntegrityValid: false,
      runtimeSanityState: 'PARADIGM_BREAK'
    })
  );

  assert.equal(result.ok, true);
  assert.equal(result.value.verdict, 'BLOCKED');
  assert.equal(result.value.allowed, false);
  assert.deepEqual(result.value.reasons, ['DATA_INTEGRITY_INVALID']);
});

test('RuntimeEnforcementOrchestrator freezes when runtime health is down', () => {
  const result = new RuntimeEnforcementOrchestrator().evaluate(
    baseInput({ runtimeHealthState: 'DOWN' })
  );

  assert.equal(result.ok, true);
  assert.equal(result.value.verdict, 'FREEZE');
  assert.equal(result.value.allowed, false);
  assert.deepEqual(result.value.reasons, ['RUNTIME_HEALTH_DOWN']);
});

test('RuntimeEnforcementOrchestrator locks on paradigm break', () => {
  const result = new RuntimeEnforcementOrchestrator().evaluate(
    baseInput({ runtimeSanityState: 'PARADIGM_BREAK' })
  );

  assert.equal(result.ok, true);
  assert.equal(result.value.verdict, 'LOCKED');
  assert.deepEqual(result.value.reasons, ['PARADIGM_BREAK_DETECTED']);
});

test('RuntimeEnforcementOrchestrator locks on drawdown lock', () => {
  const result = new RuntimeEnforcementOrchestrator().evaluate(
    baseInput({ drawdownLockState: 'DRAWDOWN_LOCKED' })
  );

  assert.equal(result.ok, true);
  assert.equal(result.value.verdict, 'LOCKED');
  assert.deepEqual(result.value.reasons, ['DRAWDOWN_LOCKED']);
});

test('RuntimeEnforcementOrchestrator returns review for degraded guards', () => {
  const result = new RuntimeEnforcementOrchestrator().evaluate(
    baseInput({ runtimeHealthState: 'DEGRADED' })
  );

  assert.equal(result.ok, true);
  assert.equal(result.value.verdict, 'REVIEW');
  assert.deepEqual(result.value.reasons, ['RUNTIME_REVIEW_REQUIRED']);
});

test('RuntimeEnforcementOrchestrator returns no-go without candidate', () => {
  const result = new RuntimeEnforcementOrchestrator().evaluate(
    baseInput({ candidateAvailable: false })
  );

  assert.equal(result.ok, true);
  assert.equal(result.value.verdict, 'NO_GO');
  assert.deepEqual(result.value.reasons, ['NO_CANDIDATE_AVAILABLE']);
});

test('RuntimeEnforcementOrchestrator rejects malformed input without silent failure', () => {
  const result = new RuntimeEnforcementOrchestrator().evaluate({
    ...baseInput(),
    runtimeSanityState: 'UNKNOWN'
  });

  assert.equal(result.ok, false);
  assert.equal(result.error, 'INVALID_RUNTIME_ENFORCEMENT_INPUT');
});
