'use strict';

/**
 * Motor de Liquidação Zero-Touch.
 * Desacopla a validação da aposta do input do usuário.
 */
class AutoSettlementEngine {
  /**
   * Avalia o número sorteado contra o alvo da estratégia.
   * @param {number} drawnNumber O número que saiu na roleta (0-36).
   * @param {Array<number>} targetNumbers Os números cobertos pela estratégia.
   * @param {number} stake Valor investido (R$).
   * @param {number} payoutMultiplier Multiplicador de lucro (ex: 2 para cores, 3 para dúzias).
   * @returns {Object} { isWin: boolean, netAmount: number }
   */
  evaluate(drawnNumber, targetNumbers, stake, payoutMultiplier = 2) {
    // Zero verde não está nas estratégias padrões externas, liquida como loss instantâneo
    if (drawnNumber === 0) {
      return { isWin: false, netAmount: stake };
    }

    const isWin = targetNumbers.includes(drawnNumber);
    
    if (isWin) {
      const grossReturn = stake * payoutMultiplier;
      const netReturn = grossReturn - stake; // Retorna apenas o Lucro Líquido
      return { isWin: true, netAmount: netReturn };
    } else {
      return { isWin: false, netAmount: stake }; // Retorna a perda da Stake
    }
  }

  // Tabela Institucional de Alvos
  static getTargets() {
    return {
      RED: [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36],
      BLACK: [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35]
    };
  }
}

module.exports = { AutoSettlementEngine };
