'use strict';

export interface BiasAnalysisResult {
  contextPressureScore: number;
  details: {
    sectorScore: number;
    repetitionScore: number;
    oscillationScore: number;
    sampleSize: number;
  };
}

export class BiasClusterDetectionEngine {
  private readonly maxWindow: number = 100;

  // Definição física dos setores do cilindro da roleta europeia
  private readonly voisinsDeZero: Set<number> = new Set([22, 18, 29, 7, 28, 12, 35, 3, 26, 0, 32, 15, 19, 4, 21, 2, 25]);
  private readonly tiersDuCylindre: Set<number> = new Set([5, 8, 10, 11, 13, 16, 23, 24, 27, 30, 33, 36]);
  private readonly orphelins: Set<number> = new Set([1, 20, 14, 31, 9, 17, 34, 6]);

  // Mapeamento de cores (true para Vermelho, false para Preto, 0 é neutro/verde)
  private readonly redNumbers: Set<number> = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

  /**
   * Executa análise assintótica O(N) limitando a janela para proteção de hardware Helio P22
   */
  public analyze(spins: number[]): BiasAnalysisResult {
    if (!spins || spins.length === 0) {
      return {
        contextPressureScore: 0,
        details: { sectorScore: 0, repetitionScore: 0, oscillationScore: 0, sampleSize: 0 }
      };
    }

    // Input Hardening: Garante o teto da janela deslizante sem alocação infinita
    const targetSpins = spins.slice(-this.maxWindow);
    const n = targetSpins.length;

    // Validação de sanidade dos dados de entrada
    for (let i = 0; i < n; i++) {
      if (typeof targetSpins[i] !== 'number' || targetSpins[i] < 0 || targetSpins[i] > 36) {
        return {
          contextPressureScore: 100, // Força pressão crítica em caso de anomalia de dados
          details: { sectorScore: 100, repetitionScore: 100, oscillationScore: 100, sampleSize: n }
        };
      }
    }

    const sectorScore = this.calculateSectorPressure(targetSpins, n);
    const repetitionScore = this.calculateRepetitionPressure(targetSpins, n);
    const oscillationScore = this.calculateOscillationPressure(targetSpins, n);

    // Agregação defensiva: O pior cenário de instabilidade dita a pressão do contexto
    const rawScore = Math.max(sectorScore, repetitionScore, oscillationScore);
    const contextPressureScore = Math.min(100, Math.max(0, Math.round(rawScore)));

    return {
      contextPressureScore,
      details: { sectorScore, repetitionScore, oscillationScore, sampleSize: n }
    };
  }

  private calculateSectorPressure(spins: number[], n: number): number {
    if (n < 10) return 0; // Histórico insuficiente para inferência de setores

    let voisinsCount = 0;
    let tiersCount = 0;
    let orphelinsCount = 0;

    for (let i = 0; i < n; i++) {
      const num = spins[i];
      if (this.voisinsDeZero.has(num)) voisinsCount++;
      else if (this.tiersDuCylindre.has(num)) tiersCount++;
      else if (this.orphelins.has(num)) orphelinsCount++;
    }

    // Proporções ideais matemáticas: Voisins: 45.9%, Tiers: 32.4%, Orphelins: 21.6%
    const voisinsRatio = voisinsCount / n;
    const tiersRatio = tiersCount / n;

    let deviation = 0;
    if (voisinsRatio > 0.60) deviation += (voisinsRatio - 0.60) * 200;
    if (tiersRatio > 0.45) deviation += (tiersRatio - 0.45) * 200;

    return Math.min(100, Math.round(deviation));
  }

  private calculateRepetitionPressure(spins: number[], n: number): number {
    if (n < 3) return 0;

    let maxStreak = 1;
    let currentStreak = 1;
    let lastColor = this.getNumberColor(spins[0]);

    for (let i = 1; i < n; i++) {
      const currentColor = this.getNumberColor(spins[i]);
      if (currentColor !== 'GREEN' && currentColor === lastColor) {
        currentStreak++;
        if (currentStreak > maxStreak) maxStreak = currentStreak;
      } else {
        currentStreak = 1;
        lastColor = currentColor;
      }
    }

    // Gatilho de pressão por repetição contínua (Sequências longas de cor geram perigo de tilt)
    if (maxStreak >= 7) {
      return Math.min(100, (maxStreak - 6) * 20);
    }

    return 0;
  }

  private calculateOscillationPressure(spins: number[], n: number): number {
    if (n < 4) return 0;

    let oscillationCount = 0;
    
    // Varre detectando padrões intermitentes repetitivos: R-B-R-B ou B-R-B-R
    for (let i = 2; i < n; i++) {
      const c2 = this.getNumberColor(spins[i]);
      const c1 = this.getNumberColor(spins[i - 1]);
      const c0 = this.getNumberColor(spins[i - 2]);

      if (c2 !== 'GREEN' && c1 !== 'GREEN' && c0 !== 'GREEN') {
        if (c2 === c0 && c2 !== c1) {
          oscillationCount++;
        }
      }
    }

    const oscillationRatio = oscillationCount / (n - 2);
    if (oscillationRatio > 0.65) {
      return Math.min(100, Math.round((oscillationRatio - 0.65) * 250));
    }

    return 0;
  }

  private getNumberColor(num: number): 'RED' | 'BLACK' | 'GREEN' {
    if (num === 0) return 'GREEN';
    return this.redNumbers.has(num) ? 'RED' : 'BLACK';
  }
}
