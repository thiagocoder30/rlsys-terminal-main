const test = require('node:test');
const assert = require('node:assert/strict');

const {
  SnapshotRevocationEngine,
  SnapshotRevocationStatus
} = require('../dist/domain/snapshot/SnapshotRevocationEngine.js');

test('returns BLOCKED on invalid integrity', () => {
  const result = SnapshotRevocationEngine.evaluate({
    runtimeSanityHealthy: true,
    dataIntegrityValid: false,
    snapshotExpired: false,
    entropyDriftScore: 0.1,
    reviewEscalationCount: 0
  });

  assert.equal(result, SnapshotRevocationStatus.BLOCKED);
});

test('returns SNAPSHOT_REVOKED on expired snapshot', () => {
  const result = SnapshotRevocationEngine.evaluate({
    runtimeSanityHealthy: true,
    dataIntegrityValid: true,
    snapshotExpired: true,
    entropyDriftScore: 0.1,
    reviewEscalationCount: 0
  });

  assert.equal(result, SnapshotRevocationStatus.SNAPSHOT_REVOKED);
});

test('returns SNAPSHOT_REVOKED on entropy drift', () => {
  const result = SnapshotRevocationEngine.evaluate({
    runtimeSanityHealthy: true,
    dataIntegrityValid: true,
    snapshotExpired: false,
    entropyDriftScore: 0.91,
    reviewEscalationCount: 0
  });

  assert.equal(result, SnapshotRevocationStatus.SNAPSHOT_REVOKED);
});

test('returns SNAPSHOT_REVIEW on escalation', () => {
  const result = SnapshotRevocationEngine.evaluate({
    runtimeSanityHealthy: true,
    dataIntegrityValid: true,
    snapshotExpired: false,
    entropyDriftScore: 0.4,
    reviewEscalationCount: 5
  });

  assert.equal(result, SnapshotRevocationStatus.SNAPSHOT_REVIEW);
});

test('returns SNAPSHOT_VALID on healthy state', () => {
  const result = SnapshotRevocationEngine.evaluate({
    runtimeSanityHealthy: true,
    dataIntegrityValid: true,
    snapshotExpired: false,
    entropyDriftScore: 0.1,
    reviewEscalationCount: 0
  });

  assert.equal(result, SnapshotRevocationStatus.SNAPSHOT_VALID);
});
