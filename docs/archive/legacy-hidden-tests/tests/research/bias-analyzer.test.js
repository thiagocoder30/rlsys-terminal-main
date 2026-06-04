const test = require('node:test');
const assert = require('node:assert');
const { WheelTopology } = require('../../dist/domain/research/WheelTopology');
const { DealerBiasAnalyzer } = require('../../dist/domain/research/DealerBiasAnalyzer');

test('WheelTopology: Retorna vizinhos corretos na roda europeia', () => {
  const cluster0 = WheelTopology.getCluster(0, 5);
  assert.deepStrictEqual(cluster0, [26, 0, 32, 15, 19]);
});

test('DealerBiasAnalyzer: Detecta viés forte (Alpha) no setor do 32', () => {
  const TOTAL_SPINS = 1000;
  const mockSpins = new Array(TOTAL_SPINS);
  const biasedTargetCluster = WheelTopology.getCluster(32, 5);
  
  // Preenchimento manual do array para evitar realocações dinâmicas
  for (let i = 0; i < TOTAL_SPINS; i++) {
    if (Math.random() < 0.25) {
      const biasedNumber = biasedTargetCluster[Math.floor(Math.random() * 5)];
      mockSpins[i] = { dealerId: 'D_ALICE', wheelSpeed: 'NORMAL', result: biasedNumber };
    } else {
      mockSpins[i] = { dealerId: 'D_ALICE', wheelSpeed: 'NORMAL', result: Math.floor(Math.random() * 37) };
    }
  }

  const config = { minSpinsRequired: 300, clusterSize: 5, minEdgeEV: 0.05 };
  
  const startTime = Date.now();
  const findings = DealerBiasAnalyzer.analyze(mockSpins, config);
  const duration = Date.now() - startTime;
  
  assert.strictEqual(findings.length > 0, true);
  
  const topFinding = findings[0];
  assert.strictEqual([26, 0, 32, 15, 19].includes(topFinding.targetSector), true);
  
  console.log(`\n[Performance Local] Análise de 1000 rodadas concluída em ${duration}ms`);
  console.log(`[Pesquisa] Alpha descoberto! Alvo: ${topFinding.targetSector}, EV: ${(topFinding.calculatedEV*100).toFixed(2)}%, Confiança: ${(topFinding.confidence*100).toFixed(2)}%`);
});

test('DealerBiasAnalyzer: Rejeita ruído aleatório perfeitamente', () => {
  const noiseSpins = new Array(500);
  for (let i = 0; i < 500; i++) {
    noiseSpins[i] = { dealerId: 'D_BOB', wheelSpeed: 'FAST', result: Math.floor(Math.random() * 37) };
  }

  const config = { minSpinsRequired: 300, clusterSize: 5, minEdgeEV: 0.15 }; 
  const findings = DealerBiasAnalyzer.analyze(noiseSpins, config);
  
  assert.strictEqual(findings.length, 0);
});
