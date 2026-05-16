const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { AppContainer } = require('../../dist/infrastructure/di/AppContainer');
const { ActionSignal } = require('../../dist/domain/decision/DecisionContracts');

const testStorageDir = path.join(__dirname, 'boot_storage');
const mockSnapshotId = 'SNAP_BOOT_TEST';
const bootTimeMs = 1500000;

// Setup: Criar um snapshot falso para o bootstrapper carregar
if (!fs.existsSync(testStorageDir)) {
  fs.mkdirSync(testStorageDir, { recursive: true });
}
const mockSnapshot = {
  metadata: { snapshotId: mockSnapshotId, compiledAtMs: 1000000, validUntilMs: 2000000, compilerVersion: "1.0" },
  constraints: { expectedDealerId: "D_ALICE", wheelSpeedCategory: "NORMAL" },
  lookupTable: {
    "D_ALICE_NORMAL": [{ targetSector: 32, clusterSize: 5, expectedEV: 0.15, confidenceScore: 0.95 }]
  }
};
fs.writeFileSync(path.join(testStorageDir, `${mockSnapshotId}.json`), JSON.stringify(mockSnapshot));

test('AppContainer: Realiza o Bootstrap com sucesso e retorna o coordenador pronto', () => {
  const config = { storageDirectory: testStorageDir, targetSnapshotId: mockSnapshotId, bootTimeMs };
  
  // O sistema "liga"
  const coordinator = AppContainer.bootstrap(config);
  assert.ok(coordinator, "Coordenador não foi instanciado.");

  // Testar um ciclo de vida real usando o coordenador recém-injetado
  const liveState = { dealerId: 'D_ALICE', wheelSpeedCategory: 'NORMAL', targetSector: 32 };
  const decision = coordinator.processLiveSpin(liveState, bootTimeMs + 100);
  
  assert.strictEqual(decision.action, ActionSignal.SIGNAL);
  assert.strictEqual(decision.reason, 'ALPHA_CONFIRMED');
});

test('AppContainer: Aplica Fail-Fast se o Snapshot não existir ou estiver expirado', () => {
  const config = { storageDirectory: testStorageDir, targetSnapshotId: 'FANTASMA', bootTimeMs };
  
  assert.throws(() => {
    AppContainer.bootstrap(config);
  }, /CRITICAL_BOOT_FAILURE/);
});

// Teardown
test('Cleanup: Remove boot storage', () => {
  fs.rmSync(testStorageDir, { recursive: true, force: true });
});
