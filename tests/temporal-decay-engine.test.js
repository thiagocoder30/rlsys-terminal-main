const test = require('node:test');
const assert = require('node:assert/strict');
const { TemporalDecayEngine } = require('../dist/domain/temporal/TemporalDecayEngine');

function signal(overrides = {}) {
  return {
    signalId: 'signal-alpha',
    label: 'Sector Alpha temporal evidence',
    observedAtSpin: 96,
    currentSpin: 100,
    baseConfidence: 0.86,
    halfLifeSpins: 24,
    hardTtlSpins: 72,
    sourceWeight: 0.9,
    ...overrides
  };
}

test('TemporalDecayEngine keeps fresh signals eligible with bounded contribution', () => {
  const result = new TemporalDecayEngine().evaluate([
    signal({ signalId: 'fresh-alpha', observedAtSpin: 98, currentSpin: 100 }),
    signal({ signalId: 'fresh-beta', observedAtSpin: 94, currentSpin: 100, sourceWeight: 0.72 })
  ]);

  assert.equal(result.success, true);
  assert.equal(result.value.engineVersion, 'temporal-decay-v1');
  assert.equal(result.value.decision, 'ALLOW');
  assert.equal(result.value.activeSignalCount, 2);
  assert.equal(result.value.expiredSignalCount, 0);
  assert.ok(result.value.aggregateFreshnessWeight > 0.8);
  assert.ok(result.value.signals.every((item) => item.weightedContribution >= 0 && item.weightedContribution <= 1));
});

test('TemporalDecayEngine blocks expired evidence before live decision', () => {
  const result = new TemporalDecayEngine().evaluate([
    signal({ signalId: 'expired-alpha', observedAtSpin: 10, currentSpin: 100, hardTtlSpins: 70 }),
    signal({ signalId: 'expired-beta', observedAtSpin: 12, currentSpin: 100, hardTtlSpins: 70 })
  ]);

  assert.equal(result.success, true);
  assert.equal(result.value.decision, 'BLOCK_EXPIRED');
  assert.equal(result.value.expiredSignalCount, 2);
  assert.ok(result.value.blockers.some((blocker) => blocker.includes('expirados')));
});

test('TemporalDecayEngine returns observation for aging but non-expired evidence', () => {
  const result = new TemporalDecayEngine({ minDecayedConfidence: 0.24, minFreshnessWeight: 0.3 }).evaluate([
    signal({ signalId: 'aging-alpha', observedAtSpin: 40, currentSpin: 100, baseConfidence: 0.82, halfLifeSpins: 46, hardTtlSpins: 90 }),
    signal({ signalId: 'aging-beta', observedAtSpin: 42, currentSpin: 100, baseConfidence: 0.8, halfLifeSpins: 46, hardTtlSpins: 90 })
  ]);

  assert.equal(result.success, true);
  assert.equal(result.value.decision, 'OBSERVE');
  assert.ok(result.value.signals.some((item) => item.status === 'AGING'));
  assert.ok(result.value.warnings.length > 0);
});

test('TemporalDecayEngine rejects malformed signal without silent failure', () => {
  const result = new TemporalDecayEngine().evaluate([
    signal({ signalId: '', observedAtSpin: 101, currentSpin: 100 })
  ]);

  assert.equal(result.success, false);
  assert.equal(result.error.code, 'TEMPORAL_DECAY_FAILED');
});
