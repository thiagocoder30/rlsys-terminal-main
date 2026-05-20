const test = require('node:test');
const assert = require('node:assert/strict');
const {
  AdaptiveSnapshotRotationEngine,
} = require('../dist/domain/snapshot/AdaptiveSnapshotRotationEngine');

const now = 1700000000000;

test('AdaptiveSnapshotRotationEngine retains safe current snapshot', () => {
  const engine = new AdaptiveSnapshotRotationEngine();

  const decision = engine.rotate({
    snapshotId: 'current',
    status: 'VALID',
    entropyDrift: 0.05,
    dealerDrift: 0.04,
    runtimeDegradation: 0.03,
    confidence: 0.94,
    generatedAtEpochMs: now,
  }, [], now);

  assert.equal(decision.verdict, 'SNAPSHOT_RETAINED');
  assert.equal(decision.activeSnapshotId, 'current');
});

test('AdaptiveSnapshotRotationEngine rotates revoked current snapshot to best valid candidate', () => {
  const engine = new AdaptiveSnapshotRotationEngine();

  const decision = engine.rotate({
    snapshotId: 'old',
    status: 'REVOKED',
    entropyDrift: 0.90,
    dealerDrift: 0.80,
    runtimeDegradation: 0.70,
    confidence: 0.20,
    generatedAtEpochMs: now,
  }, [
    {
      snapshotId: 'weak',
      status: 'VALID',
      entropyDrift: 0.20,
      dealerDrift: 0.20,
      runtimeDegradation: 0.20,
      confidence: 0.81,
      generatedAtEpochMs: now,
    },
    {
      snapshotId: 'strong',
      status: 'VALID',
      entropyDrift: 0.03,
      dealerDrift: 0.04,
      runtimeDegradation: 0.02,
      confidence: 0.95,
      generatedAtEpochMs: now,
    },
  ], now);

  assert.equal(decision.verdict, 'SNAPSHOT_ROTATED');
  assert.equal(decision.activeSnapshotId, 'strong');
  assert.equal(decision.previousSnapshotId, 'old');
});

test('AdaptiveSnapshotRotationEngine blocks when no replacement is usable', () => {
  const engine = new AdaptiveSnapshotRotationEngine();

  const decision = engine.rotate({
    snapshotId: 'expired',
    status: 'EXPIRED',
    entropyDrift: 0.50,
    dealerDrift: 0.50,
    runtimeDegradation: 0.50,
    confidence: 0.40,
    generatedAtEpochMs: now,
  }, [
    {
      snapshotId: 'bad-confidence',
      status: 'VALID',
      entropyDrift: 0.05,
      dealerDrift: 0.04,
      runtimeDegradation: 0.03,
      confidence: 0.30,
      generatedAtEpochMs: now,
    },
    {
      snapshotId: 'revoked',
      status: 'REVOKED',
      entropyDrift: 0.01,
      dealerDrift: 0.01,
      runtimeDegradation: 0.01,
      confidence: 0.99,
      generatedAtEpochMs: now,
    },
  ], now);

  assert.equal(decision.verdict, 'SNAPSHOT_BLOCKED');
  assert.equal(decision.activeSnapshotId, null);
});

test('AdaptiveSnapshotRotationEngine selects review snapshot when current is absent', () => {
  const engine = new AdaptiveSnapshotRotationEngine();

  const decision = engine.rotate(null, [
    {
      snapshotId: 'candidate',
      status: 'VALID',
      entropyDrift: 0.01,
      dealerDrift: 0.01,
      runtimeDegradation: 0.01,
      confidence: 0.91,
      generatedAtEpochMs: now,
    },
  ], now);

  assert.equal(decision.verdict, 'SNAPSHOT_REVIEW');
  assert.equal(decision.activeSnapshotId, 'candidate');
  assert.equal(decision.previousSnapshotId, null);
});
