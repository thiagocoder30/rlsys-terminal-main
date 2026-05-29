'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { WarmupSessionBootstrapEngine } = require('../../../src/domain/warmup/WarmupSessionBootstrapEngine');

test('bootstraps valid warmup into blocked institutional state', () => {
  const engine = new WarmupSessionBootstrapEngine({ allowedWarmupSizes: [6], minConfidence: 0.8 });

  const result = engine.bootstrap({
    source: 'OCR_UPLOAD',
    numbers: [0, 32, 15, 19, 4, 21],
    confidence: 0.93,
    warnings: ['minor-skew']
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.roundsLoaded, 6);
  assert.equal(result.value.manualInputMode, true);
  assert.equal(result.value.operationalGate, 'BLOCKED');
  assert.equal(result.value.paperGate, 'BLOCKED');
  assert.equal(result.value.liveGate, 'BLOCKED');
  assert.equal(result.value.productionMoneyAllowed, false);
  assert.equal(result.value.liveMoneyAuthorized, false);
});

test('rejects invalid warmup size', () => {
  const engine = new WarmupSessionBootstrapEngine({ allowedWarmupSizes: [100, 200] });

  const result = engine.bootstrap({
    source: 'MANUAL_IMPORT',
    numbers: [1, 2, 3],
    confidence: 1
  });

  assert.equal(result.ok, false);
  assert.ok(result.error.reasons.includes('invalid_warmup_size'));
});

test('rejects invalid roulette values', () => {
  const engine = new WarmupSessionBootstrapEngine({ allowedWarmupSizes: [4] });

  const result = engine.bootstrap({
    source: 'OCR_UPLOAD',
    numbers: [1, 2, 37, 4],
    confidence: 1
  });

  assert.equal(result.ok, false);
  assert.ok(result.error.reasons.includes('roulette_number_out_of_range'));
});

test('rejects low confidence OCR warmup', () => {
  const engine = new WarmupSessionBootstrapEngine({ allowedWarmupSizes: [4], minConfidence: 0.9 });

  const result = engine.bootstrap({
    source: 'OCR_UPLOAD',
    numbers: [1, 2, 3, 4],
    confidence: 0.7
  });

  assert.equal(result.ok, false);
  assert.ok(result.error.reasons.includes('warmup_confidence_below_minimum'));
});

test('is deterministic and idempotent', () => {
  const engine = new WarmupSessionBootstrapEngine({ allowedWarmupSizes: [5] });
  const input = {
    source: 'MANUAL_IMPORT',
    numbers: [1, 2, 3, 4, 5],
    confidence: 1
  };

  const first = engine.bootstrap(input);
  const second = engine.bootstrap(input);

  assert.deepEqual(first, second);
  assert.equal(first.value.sessionId, second.value.sessionId);
});

test('preserves input immutability from external mutation', () => {
  const engine = new WarmupSessionBootstrapEngine({ allowedWarmupSizes: [3] });
  const numbers = [1, 2, 3];

  const result = engine.bootstrap({
    source: 'MANUAL_IMPORT',
    numbers,
    confidence: 1
  });

  numbers[0] = 36;

  assert.equal(result.value.numbers[0], 1);
});

test('validates configuration defensively', () => {
  assert.throws(
    () => new WarmupSessionBootstrapEngine({ allowedWarmupSizes: [] }),
    /allowedWarmupSizes/
  );

  assert.throws(
    () => new WarmupSessionBootstrapEngine({ minConfidence: 2 }),
    /minConfidence/
  );
});
