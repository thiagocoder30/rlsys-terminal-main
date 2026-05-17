export interface SignatureStats {
  plays: number;
  hits: number;
}

export class SelfLearningEngine {
  private readonly statsMap = new Map<string, SignatureStats>();

  // Processa uma linha de telemetria O(1)
  public ingestTelemetry(dealerId: string, speed: string, sector: number, action: string, pnl: number): void {
    if (action !== 'SIGNAL' || isNaN(pnl)) return;

    const key = `${dealerId}_${speed}_${sector}`;
    const current = this.statsMap.get(key) || { plays: 0, hits: 0 };
    
    current.plays += 1;
    if (pnl > 0) current.hits += 1;

    this.statsMap.set(key, current);
  }

  // Refina o Snapshot de Conhecimento
  public refineSnapshot(existingSnapshot: any): any {
    const updatedSnapshot = JSON.parse(JSON.stringify(existingSnapshot)); // Clone profundo seguro
    
    if (!updatedSnapshot.lookupTable) updatedSnapshot.lookupTable = {};

    this.statsMap.forEach((stats, key) => {
      // Cálculo de EV empírico
      const winRate = stats.hits / stats.plays;
      const calculatedEV = (winRate * 35) - ((1 - winRate) * 1);
      
      // Lei dos Grandes Números: Confiança baseada no tamanho da amostra (Máx 10 para base)
      const sampleConfidence = Math.min(stats.plays / 10, 1.0);
      const finalConfidence = Math.max(0.1, sampleConfidence); // Mínimo de 10%

      // Se a assinatura já existir, atualiza; senão, cria uma nova.
      // O Alvo do Setor seria calculado pelo Tracker, assumimos o alvo atual do snapshot ou 0 se novo.
      let targetSector = 0;
      if (updatedSnapshot.lookupTable[key] && updatedSnapshot.lookupTable[key].length > 0) {
        targetSector = updatedSnapshot.lookupTable[key][0].targetSector;
      }

      updatedSnapshot.lookupTable[key] = [{
        targetSector: targetSector,
        clusterSize: 5,
        expectedEV: Number(calculatedEV.toFixed(4)),
        confidenceScore: Number(finalConfidence.toFixed(4))
      }];
    });

    updatedSnapshot.metadata.compiledAtMs = Date.now();
    return updatedSnapshot;
  }
}
