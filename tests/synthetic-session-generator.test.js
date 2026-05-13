import test from 'node:test';
import assert from 'node:assert/strict';
import { SyntheticSessionGenerator } from '../dist/domain/research/SyntheticSessionGenerator.js';

const generator = new SyntheticSessionGenerator();

test('SyntheticSessionGenerator creates deterministic balanced control sessions', () => {
  const request = {
    sessionId: 'synthetic-balanced-control',
    roundCount: 240,
    seed: 1234,
    pattern: 'BALANCED',
    policy: { minRounds: 37, maxRounds: 1_000, noiseRate: 0.01 }
  };

  const first = generator.generate(request);
  const second = generator.generate(request);

  assert.equal(first.success, true);
  assert.equal(second.success, true);
  assert.equal(first.value.status, 'GENERATED');
  assert.equal(first.value.rounds.length, 240);
  assert.equal(first.value.checksum, second.value.checksum);
  assert.ok(first.value.metrics.uniqueNumbers > 30);
  assert.ok(first.value.metrics.entropyScore > 0.85);
});

test('SyntheticSessionGenerator injects sector bias for physical-edge research', () => {
  const result = generator.generate({
    sessionId: 'synthetic-sector-bias',
    roundCount: 300,
    seed: 77,
    pattern: 'SECTOR_BIAS',
    dealer: { dealerId: 'dealer-a', preferredSector: 'TIERS', signatureStrength: 0.7 },
    policy: { minRounds: 37, biasStrength: 0.55, noiseRate: 0.02 }
  });

  assert.equal(result.success, true);
  assert.equal(result.value.status, 'REVIEW_REQUIRED');
  assert.equal(result.value.metrics.dominantSector, 'TIERS');
  assert.ok(result.value.metrics.dominantSectorShare > 0.45);
  assert.ok(result.value.warnings.length > 0);
});

test('SyntheticSessionGenerator creates drifting sessions with multiple segments', () => {
  const result = generator.generate({
    sessionId: 'synthetic-drift',
    roundCount: 360,
    seed: 99,
    pattern: 'DRIFTING',
    policy: { driftInterval: 60, biasStrength: 0.65, noiseRate: 0.03 }
  });

  assert.equal(result.success, true);
  assert.equal(result.value.status, 'REVIEW_REQUIRED');
  assert.equal(result.value.metrics.driftSegments, 6);
  assert.ok(result.value.rounds.some((round) => round.syntheticTag.includes('drifting')));
});

test('SyntheticSessionGenerator blocks oversized batches for low-memory devices', () => {
  const result = generator.generate({
    sessionId: 'synthetic-too-large',
    roundCount: 5_001,
    seed: 1,
    pattern: 'BALANCED',
    policy: { maxRounds: 5_000, minRounds: 37 }
  });

  assert.equal(result.success, true);
  assert.equal(result.value.status, 'BLOCKED');
  assert.equal(result.value.rounds.length, 0);
  assert.ok(result.value.blockers.some((blocker) => blocker.includes('exceeds maxRounds')));
});

test('SyntheticSessionGenerator rejects malformed requests without silent failure', () => {
  const result = generator.generate({
    sessionId: '',
    roundCount: -1,
    seed: -7,
    pattern: 'UNKNOWN'
  });

  assert.equal(result.success, false);
  assert.equal(result.error.code, 'SYNTHETIC_SESSION_INVALID_REQUEST');
});
