const test = require('node:test');
const assert = require('node:assert');
const { KnowledgeCompiler } = require('../../dist/domain/knowledge/KnowledgeCompiler');

const config = {
  minExpectedValue: 0.05, // Edge de 5%
  minConfidence: 0.80,    // 80% Confiança
  snapshotLifespanMs: 86400000, // 24 horas
  compilerVersion: "1.0.0"
};

const rawData = [
  // Sinal Valido
  { dealerId: 'D_ALICE', wheelSpeed: 'NORMAL', targetSector: 32, clusterSize: 5, calculatedEV: 0.10, confidence: 0.90 },
  // Sinal Invalido (EV Negativo/Abaixo do mínimo)
  { dealerId: 'D_ALICE', wheelSpeed: 'NORMAL', targetSector: 15, clusterSize: 3, calculatedEV: -0.02, confidence: 0.85 },
  // Sinal Invalido (Baixa Confiança)
  { dealerId: 'D_ALICE', wheelSpeed: 'NORMAL', targetSector: 0, clusterSize: 5, calculatedEV: 0.08, confidence: 0.60 }
];

test('KnowledgeCompiler: Compila snapshot apenas com dados validos (Filtra ruido)', () => {
  const result = KnowledgeCompiler.compile('SNAP_01', rawData, config, 1000000);
  
  assert.strictEqual(result.success, true);
  if (result.success) { // Type guard
    const lookupKey = 'D_ALICE_NORMAL';
    assert.strictEqual(result.snapshot.lookupTable[lookupKey].length, 1);
    assert.strictEqual(result.snapshot.lookupTable[lookupKey][0].targetSector, 32);
    assert.strictEqual(result.snapshot.metadata.validUntilMs, 1000000 + 86400000);
  }
});

test('KnowledgeCompiler: Aborta compilação se nenhum dado atingir os criterios mínimos', () => {
  const weakData = [
    { dealerId: 'D_BOB', wheelSpeed: 'FAST', targetSector: 12, clusterSize: 5, calculatedEV: 0.01, confidence: 0.50 }
  ];
  
  const result = KnowledgeCompiler.compile('SNAP_02', weakData, config, 1000000);
  assert.strictEqual(result.success, false);
  assert.strictEqual(result.error, 'NO_VALID_ALPHA_FOUND_AFTER_FILTERING');
});

test('KnowledgeCompiler: Aborta se array de pesquisa for vazio', () => {
  const result = KnowledgeCompiler.compile('SNAP_03', [], config, 1000000);
  assert.strictEqual(result.success, false);
  assert.strictEqual(result.error, 'EMPTY_RESEARCH_DATA');
});
