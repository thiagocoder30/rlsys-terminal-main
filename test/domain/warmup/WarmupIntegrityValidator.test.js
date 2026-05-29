'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { WarmupSessionBootstrapEngine } = require('../../../src/domain/warmup/WarmupSessionBootstrapEngine');
const { WarmupIntegrityValidator } = require('../../../src/domain/warmup/WarmupIntegrityValidator');

function createValidWarmupState(size) {
  const numbers = [];

  for (let index = 0; index < size; index += 1) {
    numbers.push(index % 37);
  }

  const bootstrap = new WarmupSessionBootstrapEngine({
    allowedWarmupSizes: [size],
    minConfidence: 0.8
  });

  const result = bootstrap.bootstrap({
    source: 'MANUAL_IMPORT',
    numbers,
    confidence: 0.97
  });

  assert.equal(result.ok, true);
  return result.value;
}

test('validates a bootstrapped institutional warmup state', () => {
  const state = createValidWarmupState(100);
  const validator = new WarmupIntegrityValidator({ allowedWarmupSizes: [100] });

  const report = validator.validate(state);

  assert.equal(report.status, 'VALID');
  assert.equal(report.valid, true);
  assert.equal(report.reasons.length, 0);
  assert.equal(report.roundsValidated, 100);
  assert.equal(report.operationalGate, 'BLOCKED');
  assert.equal(report.paperGate, 'BLOCKED');
  assert.equal(report.liveGate, 'BLOCKED');
  assert.equal(report.productionMoneyAllowed, false);
  assert.equal(report.liveMoneyAuthorized, false);
});

test('rejects warmup state with invalid size', () => {
  const state = createValidWarmupState(12);
  const validator = new WarmupIntegrityValidator({ allowedWarmupSizes: [100, 200] });

  const report = validator.validate(state);

  assert.equal(report.status, 'INVALID');
  assert.ok(report.reasons.includes('invalid_warmup_size'));
});

test('rejects live money authorization invariant violation', () => {
  const state = createValidWarmupState(20);
  const validator = new WarmupIntegrityValidator({ allowedWarmupSizes: [20] });

  const report = validator.validate({
    ...state,
    liveMoneyAuthorized: true
  });

  assert.equal(report.status, 'INVALID');
  assert.ok(report.reasons.includes('live_money_must_remain_disabled'));
});

test('rejects paper gate opened during warmup integrity phase', () => {
  const state = createValidWarmupState(20);
  const validator = new WarmupIntegrityValidator({ allowedWarmupSizes: [20] });

  const report = validator.validate({
    ...state,
    paperGate: 'OPEN'
  });

  assert.equal(report.status, 'INVALID');
  assert.ok(report.reasons.includes('paper_gate_must_start_blocked'));
});

test('detects roulette numbers out of range', () => {
  const state = createValidWarmupState(10);
  const validator = new WarmupIntegrityValidator({ allowedWarmupSizes: [10] });

  const report = validator.validate({
    ...state,
    numbers: [0, 1, 2, 3, 4, 5, 6, 37, 8, 9]
  });

  assert.equal(report.status, 'INVALID');
  assert.ok(report.reasons.includes('roulette_number_out_of_range'));
});

test('detects excessive single number dominance', () => {
  const validator = new WarmupIntegrityValidator({
    allowedWarmupSizes: [10],
    maxSingleNumberDominanceRatio: 0.4
  });

  const report = validator.validate({
    sessionId: 'warmup-test',
    source: 'MANUAL_IMPORT',
    numbers: [7, 7, 7, 7, 7, 1, 2, 3, 4, 5],
    confidence: 1,
    fingerprint: 'abc123',
    manualInputMode: true,
    operationalGate: 'BLOCKED',
    paperGate: 'BLOCKED',
    liveGate: 'BLOCKED',
    productionMoneyAllowed: false,
    liveMoneyAuthorized: false
  });

  assert.equal(report.status, 'INVALID');
  assert.ok(report.reasons.includes('single_number_dominance_too_high'));
});

test('detects excessive consecutive repeats', () => {
  const validator = new WarmupIntegrityValidator({
    allowedWarmupSizes: [10],
    maxConsecutiveRepeat: 3,
    maxSingleNumberDominanceRatio: 1
  });

  const report = validator.validate({
    sessionId: 'warmup-test',
    source: 'MANUAL_IMPORT',
    numbers: [9, 9, 9, 9, 1, 2, 3, 4, 5, 6],
    confidence: 1,
    fingerprint: 'abc123',
    manualInputMode: true,
    operationalGate: 'BLOCKED',
    paperGate: 'BLOCKED',
    liveGate: 'BLOCKED',
    productionMoneyAllowed: false,
    liveMoneyAuthorized: false
  });

  assert.equal(report.status, 'INVALID');
  assert.ok(report.reasons.includes('consecutive_repeat_too_high'));
});

test('is deterministic and idempotent', () => {
  const state = createValidWarmupState(30);
  const validator = new WarmupIntegrityValidator({ allowedWarmupSizes: [30] });

  const first = validator.validate(state);
  const second = validator.validate(state);

  assert.deepEqual(first, second);
});

test('validates configuration defensively', () => {
  assert.throws(
    () => new WarmupIntegrityValidator({ allowedWarmupSizes: [] }),
    /allowedWarmupSizes/
  );

  assert.throws(
    () => new WarmupIntegrityValidator({ minConfidence: -1 }),
    /minConfidence/
  );

  assert.throws(
    () => new WarmupIntegrityValidator({ maxConsecutiveRepeat: 0 }),
    /maxConsecutiveRepeat/
  );
});
