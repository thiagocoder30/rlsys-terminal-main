const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { FileSnapshotLoader } = require('../../dist/infrastructure/storage/FileSnapshotLoader');

const testStorageDir = path.join(__dirname, 'mock_snapshots');
const mockCurrentTimeMs = 1500000;

const validSnapshotData = {
  metadata: {
    snapshotId: "TEST_SNAP_01",
    compiledAtMs: 1000000,
    validUntilMs: 2000000,
    compilerVersion: "1.0.0"
  },
  constraints: { expectedDealerId: "D01", wheelSpeedCategory: "NORMAL" },
  lookupTable: { "D01_NORMAL": [] }
};

// Setup
if (!fs.existsSync(testStorageDir)) {
  fs.mkdirSync(testStorageDir, { recursive: true });
}
fs.writeFileSync(path.join(testStorageDir, 'TEST_SNAP_01.json'), JSON.stringify(validSnapshotData));
fs.writeFileSync(path.join(testStorageDir, 'CORRUPT_SNAP.json'), '{ invalid_json: "yes"'); // JSON quebrado

test('SnapshotLoader: Carrega e aprova pacote íntegro', () => {
  const loader = new FileSnapshotLoader(testStorageDir);
  const result = loader.load('TEST_SNAP_01', mockCurrentTimeMs);
  
  assert.strictEqual(result.success, true);
  if (result.success) {
    assert.strictEqual(result.snapshot.metadata.snapshotId, "TEST_SNAP_01");
  }
});

test('SnapshotLoader: Rejeita ficheiro inexistente (No Silent Failure)', () => {
  const loader = new FileSnapshotLoader(testStorageDir);
  const result = loader.load('GHOST_SNAP', mockCurrentTimeMs);
  
  assert.strictEqual(result.success, false);
  assert.strictEqual(result.error, 'SNAPSHOT_FILE_NOT_FOUND');
});

test('SnapshotLoader: Rejeita ficheiro corrompido (Falha no Parse)', () => {
  const loader = new FileSnapshotLoader(testStorageDir);
  const result = loader.load('CORRUPT_SNAP', mockCurrentTimeMs);
  
  assert.strictEqual(result.success, false);
  assert.strictEqual(result.error, 'JSON_PARSE_ERROR_CORRUPT_FILE');
});

test('SnapshotLoader: Rejeita ficheiro com validade expirada', () => {
  const loader = new FileSnapshotLoader(testStorageDir);
  // Passando o tempo além de 2000000 (limite do mock)
  const result = loader.load('TEST_SNAP_01', 2500000); 
  
  assert.strictEqual(result.success, false);
  assert.match(result.error, /INTEGRITY_OR_EXPIRATION_FAILURE: SNAPSHOT_EXPIRED/);
});

// Teardown
test('Cleanup: Remove mock storage', () => {
  fs.rmSync(testStorageDir, { recursive: true, force: true });
});
