const test = require('node:test');
const assert = require('node:assert');
const { DecisionLookupEngine } = require('../../dist/domain/decision/DecisionLookupEngine');
const { ActionSignal } = require('../../dist/domain/decision/DecisionContracts');

// Mock do Snapshot (Como se tivesse sido carregado pela Sprint 041)
const mockSnapshot = {
  metadata: { snapshotId: "SNAP_01", compiledAtMs: 1000, validUntilMs: 9000, compilerVersion: "1.0" },
  constraints: { expectedDealerId: "D_ALICE", wheelSpeedCategory: "NORMAL" },
  lookupTable: {
    "D_ALICE_NORMAL": [
      { targetSector: 32, clusterSize: 5, expectedEV: 0.15, confidenceScore: 0.95 }, // Alpha Forte
      { targetSector: 15, clusterSize: 3, expectedEV: 0.05, confidenceScore: 0.70 }  // Alpha Fraco (Deve virar OBSERVE)
    ]
  }
};

test('DecisionEngine: Emite SIGNAL para Alpha Confirmado', () => {
  const liveState = { dealerId: "D_ALICE", wheelSpeedCategory: "NORMAL", targetSector: 32 };
  const result = DecisionLookupEngine.evaluate(liveState, mockSnapshot);
  
  assert.strictEqual(result.action, ActionSignal.SIGNAL);
  assert.strictEqual(result.reason, 'ALPHA_CONFIRMED');
});

test('DecisionEngine: Emite OBSERVE para Alpha com confiança marginal', () => {
  const liveState = { dealerId: "D_ALICE", wheelSpeedCategory: "NORMAL", targetSector: 15 };
  const result = DecisionLookupEngine.evaluate(liveState, mockSnapshot);
  
  assert.strictEqual(result.action, ActionSignal.OBSERVE);
  assert.strictEqual(result.reason, 'WEAK_CONFIDENCE');
});

test('DecisionEngine: Emite NO_GO por padrão em Setor sem Edge', () => {
  const liveState = { dealerId: "D_ALICE", wheelSpeedCategory: "NORMAL", targetSector: 0 };
  const result = DecisionLookupEngine.evaluate(liveState, mockSnapshot);
  
  assert.strictEqual(result.action, ActionSignal.NO_GO);
  assert.strictEqual(result.reason, 'SECTOR_NO_EDGE');
});

test('DecisionEngine: Emite NO_GO imediato em Regime não mapeado (O(1) Fallback)', () => {
  // Mesmo Dealer, mas a roda está RÁPIDA (FAST). O snapshot só tem edge para NORMAL.
  const liveState = { dealerId: "D_ALICE", wheelSpeedCategory: "FAST", targetSector: 32 };
  const result = DecisionLookupEngine.evaluate(liveState, mockSnapshot);
  
  assert.strictEqual(result.action, ActionSignal.NO_GO);
  assert.strictEqual(result.reason, 'REGIME_NOT_IN_SNAPSHOT');
});
