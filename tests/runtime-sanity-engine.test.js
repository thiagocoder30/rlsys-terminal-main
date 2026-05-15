const test = require('node:test');
const assert = require('node:assert');

const {
  RuntimeSanityEngine
} = require('../dist/domain/runtime/RuntimeSanityEngine');

function buildHealthyInput() {
  return {
    snapshotId: 'snapshot-alpha-v1',
    sampleSize: 120,
    snapshotConfidence: 0.86,
    dataIntegrityScore: 0.98,
    regimeMismatchScore: 0.08,
    spatialDriftScore: 0.06,
    distribution: [
      { key: 'sector-0', expectedRatio: 0.25, observedRatio: 0.24 },
      { key: 'sector-1', expectedRatio: 0.25, observedRatio: 0.26 },
      { key: 'sector-2', expectedRatio: 0.25, observedRatio: 0.25 },
      { key: 'sector-3', expectedRatio: 0.25, observedRatio: 0.25 }
    ]
  };
}

test('RuntimeSanityEngine accepts healthy runtime alignment', () => {
  const engine = new RuntimeSanityEngine();
  const result = engine.evaluate(buildHealthyInput());

  assert.equal(result.ok, true);
  assert.equal(result.value.status, 'SANITY_OK');
  assert.equal(result.value.primaryReason, 'RUNTIME_MATCHES_SNAPSHOT');
  assert.equal(typeof result.value.auditChecksum, 'string');
});

test('RuntimeSanityEngine requires review for moderate divergence', () => {
  const engine = new RuntimeSanityEngine();
  const input = {
    ...buildHealthyInput(),
    distribution: [
      { key: 'sector-0', expectedRatio: 0.25, observedRatio: 0.45 },
      { key: 'sector-1', expectedRatio: 0.25, observedRatio: 0.20 },
      { key: 'sector-2', expectedRatio: 0.25, observedRatio: 0.20 },
      { key: 'sector-3', expectedRatio: 0.25, observedRatio: 0.15 }
    ]
  };

  const result = engine.evaluate(input);

  assert.equal(result.ok, true);
  assert.equal(result.value.status, 'SANITY_REVIEW');
});

test('RuntimeSanityEngine detects paradigm break under severe divergence', () => {
  const engine = new RuntimeSanityEngine();
  const input = {
    ...buildHealthyInput(),
    regimeMismatchScore: 0.74,
    spatialDriftScore: 0.69,
    distribution: [
      { key: 'sector-0', expectedRatio: 0.25, observedRatio: 0.80 },
      { key: 'sector-1', expectedRatio: 0.25, observedRatio: 0.08 },
      { key: 'sector-2', expectedRatio: 0.25, observedRatio: 0.07 },
      { key: 'sector-3', expectedRatio: 0.25, observedRatio: 0.05 }
    ]
  };

  const result = engine.evaluate(input);

  assert.equal(result.ok, true);
  assert.equal(result.value.status, 'PARADIGM_BREAK');
  assert.equal(result.value.primaryReason, 'RUNTIME_DIVERGED_FROM_SNAPSHOT');
});

test('RuntimeSanityEngine blocks insufficient runtime sample', () => {
  const engine = new RuntimeSanityEngine();
  const result = engine.evaluate({
    ...buildHealthyInput(),
    sampleSize: 8
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.status, 'BLOCKED');
  assert.equal(result.value.primaryReason, 'INSUFFICIENT_RUNTIME_SAMPLE');
});

test('RuntimeSanityEngine rejects malformed runtime input', () => {
  const engine = new RuntimeSanityEngine();
  const result = engine.evaluate({
    ...buildHealthyInput(),
    distribution: [
      { key: 'sector-0', expectedRatio: 0.25, observedRatio: 1.4 }
    ]
  });

  assert.equal(result.ok, false);
  assert.equal(result.error, 'INVALID_OBSERVED_RATIO');
});
