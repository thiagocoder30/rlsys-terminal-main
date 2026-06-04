const test = require('node:test');
const assert = require('node:assert');
const { SnapshotValidator } = require('../../dist/domain/knowledge/SnapshotValidator');

const validSnapshot = {
  metadata: {
    snapshotId: "SNAP_001_A",
    compiledAtMs: 1000000,
    validUntilMs: 2000000,
    compilerVersion: "1.0.0"
  },
  constraints: {
    expectedDealerId: "D_ALICE_01",
    wheelSpeedCategory: "NORMAL"
  },
  lookupTable: {
    "STATE_01": [{ targetSector: 32, clusterSize: 5, expectedEV: 0.12, confidenceScore: 0.88 }]
  }
};

test('SnapshotValidator: Aprova um snapshot valido e nao expirado', () => {
  const result = SnapshotValidator.validate(validSnapshot, 1500000);
  assert.strictEqual(result.isValid, true);
});

test('SnapshotValidator: Rejeita um snapshot expirado (Decay Temporal)', () => {
  const result = SnapshotValidator.validate(validSnapshot, 2500000);
  assert.strictEqual(result.isValid, false);
  assert.strictEqual(result.error, 'SNAPSHOT_EXPIRED');
});

test('SnapshotValidator: Rejeita pacotes malformados', () => {
  const corruptSnapshot = { metadata: validSnapshot.metadata }; // Faltam campos
  const result = SnapshotValidator.validate(corruptSnapshot, 1500000);
  assert.strictEqual(result.isValid, false);
  assert.strictEqual(result.error, 'MISSING_CORE_STRUCTURE');
});
