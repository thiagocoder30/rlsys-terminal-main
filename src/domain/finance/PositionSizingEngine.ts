export class PositionSizingEngine {
  private static readonly MAX_UNITS = 5;
  private static readonly MIN_UNITS = 1;

  /**
   * Calcula o tamanho da aposta baseado num Kelly Fracionário simplificado e no Drawdown.
   * Complexidade: O(1) - Zero Memory Allocation.
   */
  public static calculateUnits(expectedEV: number, confidence: number, consecutiveLosses: number): number {
    if (expectedEV <= 0) return 0;

    // 1. Base Sizing (Heurística baseada em EV e Confiança)
    // Ex: EV 0.15 (15%) * 10 = 1.5. * 0.95 = 1.425
    let baseUnits = (expectedEV * 10) * confidence;

    // 2. Defensive Scaling (Proteger o capital durante sequências de perdas)
    // 0 perdas: 1.0x (Força Total)
    // 1 perda:  0.8x (Atenção)
    // 2 perdas: 0.5x (Modo Sobrevivência)
    let defensiveMultiplier = 1.0;
    if (consecutiveLosses === 1) defensiveMultiplier = 0.8;
    if (consecutiveLosses >= 2) defensiveMultiplier = 0.5;

    let finalUnits = baseUnits * defensiveMultiplier;

    // 3. Clamping e Arredondamento (Garantir valores jogáveis no casino)
    // Arredondamos para a metade mais próxima (Ex: 1.5, 2.0)
    finalUnits = Math.round(finalUnits * 2) / 2;

    if (finalUnits < this.MIN_UNITS) return this.MIN_UNITS;
    if (finalUnits > this.MAX_UNITS) return this.MAX_UNITS;

    return finalUnits;
  }
}
