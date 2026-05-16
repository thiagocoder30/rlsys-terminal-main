import { WheelTopology } from './WheelTopology';
import { RawResearchSector } from '../knowledge/CompilerContracts';

export interface SpinRecord {
  readonly dealerId: string;
  readonly wheelSpeed: 'SLOW' | 'NORMAL' | 'FAST' | 'ANY';
  readonly result: number;
}

export interface AnalyzerConfig {
  readonly minSpinsRequired: number;
  readonly clusterSize: number;
  readonly minEdgeEV: number; 
}

export class DealerBiasAnalyzer {
  /**
   * Analisa um histórico de rodadas usando flat loops O(N) para poupar memória RAM.
   */
  public static analyze(spins: SpinRecord[], config: AnalyzerConfig): RawResearchSector[] {
    const totalSpins = spins.length;
    if (totalSpins < config.minSpinsRequired) {
      return []; 
    }

    const findings: RawResearchSector[] = [];
    const dealerId = spins[0].dealerId;
    const wheelSpeed = spins[0].wheelSpeed;
    const payoutMultiplier = 36 / config.clusterSize;

    // Itera pelos 37 centros possíveis na roda (0 a 36)
    for (let targetSector = 0; targetSector <= 36; targetSector++) {
      const cluster = WheelTopology.getCluster(targetSector, config.clusterSize);
      let hitCount = 0;

      // Flat loop para evitar iterações com callback
      for (let i = 0; i < totalSpins; i++) {
        if (WheelTopology.isHit(spins[i].result, cluster)) {
          hitCount++;
        }
      }

      const observedProbability = hitCount / totalSpins;
      const expectedValue = (observedProbability * payoutMultiplier) - 1;

      if (expectedValue >= config.minEdgeEV) {
        // Fórmula de confiança heurística
        const confidence = Math.min(1.0, 0.50 + (totalSpins / 1000) * 0.40);

        findings.push({
          dealerId,
          wheelSpeed,
          targetSector,
          clusterSize: config.clusterSize,
          calculatedEV: expectedValue,
          confidence
        });
      }
    }

    // Ordena inplace pelo melhor EV
    return findings.sort((a, b) => b.calculatedEV - a.calculatedEV);
  }
}
