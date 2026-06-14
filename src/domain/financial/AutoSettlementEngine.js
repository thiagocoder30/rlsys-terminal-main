'use strict';

/**
 * Motor Polimórfico de Liquidação.
 * Suporta estratégias complexas com múltiplos níveis de retorno (Win, Min Win, Push, Loss).
 */
class AutoSettlementEngine {
  
  static get RED_NUMS() { return [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]; }
  static get BLACK_NUMS() { return [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35]; }
  static get COL2_NUMS() { return [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35]; }
  static get COL3_NUMS() { return [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36]; }

  evaluate(drawnNumber, strategyId) {
    const strat = AutoSettlementEngine.getStrategies()[strategyId];
    if (!strat) throw new Error('Estratégia não mapeada.');
    return strat.evaluate(drawnNumber);
  }

  static getStrategies() {
    return {
      'HEDGE_BLACK_COL3': {
        name: 'Hedge Black Col 3',
        stake: 2.70,
        evaluate: (num) => {
          if (num === 0) return { status: 'LOSS', netAmount: -2.70 };
          const isBlack = AutoSettlementEngine.BLACK_NUMS.includes(num);
          const isCol3 = AutoSettlementEngine.COL3_NUMS.includes(num);
          
          if (isBlack && isCol3) return { status: 'WIN_MAX', netAmount: 3.60 };
          if (isBlack && !isCol3) return { status: 'WIN_MIN', netAmount: 0.90 };
          if (!isBlack && isCol3) return { status: 'PUSH', netAmount: 0.00 }; // Defesa
          return { status: 'LOSS', netAmount: -2.70 };
        }
      },
      'HEDGE_RED_COL2': {
        name: 'Hedge Red Col 2',
        stake: 2.70,
        evaluate: (num) => {
          if (num === 0) return { status: 'LOSS', netAmount: -2.70 };
          const isRed = AutoSettlementEngine.RED_NUMS.includes(num);
          const isCol2 = AutoSettlementEngine.COL2_NUMS.includes(num);
          
          if (isRed && isCol2) return { status: 'WIN_MAX', netAmount: 3.60 };
          if (isRed && !isCol2) return { status: 'WIN_MIN', netAmount: 0.90 };
          if (!isRed && isCol2) return { status: 'PUSH', netAmount: 0.00 }; // Defesa
          return { status: 'LOSS', netAmount: -2.70 };
        }
      },
      // FUSION MANTIDA COMO LEGADO DA SPRINT ANTERIOR
      'FUSION_SECTOR': {
        name: 'Fusion Reduzida (Setor do 23)',
        stake: 1.90,
        evaluate: (num) => {
          const targets = [17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31];
          if (targets.includes(num)) return { status: 'WIN_MAX', netAmount: 1.70 };
          return { status: 'LOSS', netAmount: -1.90 };
        }
      }
    };
  }
}

module.exports = { AutoSettlementEngine };
