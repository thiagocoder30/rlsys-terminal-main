'use strict';

class AutoSettlementEngine {
  static get RED_NUMS() { return [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]; }
  static get BLACK_NUMS() { return [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35]; }
  static get COL2_NUMS() { return [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35]; }
  static get COL3_NUMS() { return [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36]; }

  evaluate(drawnNumber, strategyId) {
    const strat = AutoSettlementEngine.getStrategies()[strategyId];
    if (!strat) throw new Error(`Estratégia [${strategyId}] não mapeada no motor contábil.`);
    return strat.evaluate(drawnNumber);
  }

  static getStrategies() {
    return {
      'HEDGE_BLACK_COL3': {
        name: 'Hedge Black Col 3', stake: 2.70,
        evaluate: (num) => {
          if (num === 0) return { status: 'LOSS', netAmount: -2.70 };
          const isBlack = AutoSettlementEngine.BLACK_NUMS.includes(num);
          const isCol3 = AutoSettlementEngine.COL3_NUMS.includes(num);
          if (isBlack && isCol3) return { status: 'WIN_MAX', netAmount: 3.60 };
          if (isBlack && !isCol3) return { status: 'WIN_MIN', netAmount: 0.90 };
          if (!isBlack && isCol3) return { status: 'PUSH', netAmount: 0.00 };
          return { status: 'LOSS', netAmount: -2.70 };
        }
      },
      'HEDGE_RED_COL2': {
        name: 'Hedge Red Col 2', stake: 2.70,
        evaluate: (num) => {
          if (num === 0) return { status: 'LOSS', netAmount: -2.70 };
          const isRed = AutoSettlementEngine.RED_NUMS.includes(num);
          const isCol2 = AutoSettlementEngine.COL2_NUMS.includes(num);
          if (isRed && isCol2) return { status: 'WIN_MAX', netAmount: 3.60 };
          if (isRed && !isCol2) return { status: 'WIN_MIN', netAmount: 0.90 };
          if (!isRed && isCol2) return { status: 'PUSH', netAmount: 0.00 };
          return { status: 'LOSS', netAmount: -2.70 };
        }
      },
      'SECTOR_OMEGA': {
        name: 'Sector Omega', stake: 2.00,
        evaluate: (num) => {
          const targets = [0, 1, 5, 6, 8, 9, 10, 11, 13, 14, 16, 17, 20, 23, 24, 30, 31, 33, 36];
          if (targets.includes(num)) return { status: 'WIN_MAX', netAmount: 1.60 };
          return { status: 'LOSS', netAmount: -2.00 };
        }
      },
      'SECTOR_ALPHA': {
        name: 'Sector Alpha', stake: 2.50,
        evaluate: (num) => {
          const targets = [0, 1, 2, 3, 4, 6, 7, 9, 12, 14, 15, 17, 18, 19, 20, 21, 22, 25, 26, 28, 29, 31, 32, 34, 35];
          if (targets.includes(num)) return { status: 'WIN_MAX', netAmount: 1.10 };
          return { status: 'LOSS', netAmount: -2.50 };
        }
      },
      'FUSION_SECTOR': {
        name: 'Fusion Reduzida (Setor do 23)', stake: 1.90,
        evaluate: (num) => {
          const targets = [17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31];
          if (targets.includes(num)) return { status: 'WIN_MAX', netAmount: 1.70 };
          return { status: 'LOSS', netAmount: -1.90 };
        }
      },
      // TRIPLICAÇÃO - CORES
      'TRIPLICACAO_RED': {
        name: 'Triplicação (Alvo: VERMELHO)', stake: 1.00,
        evaluate: (num) => {
          if (num === 0) return { status: 'LOSS', netAmount: -1.00 };
          if (AutoSettlementEngine.RED_NUMS.includes(num)) return { status: 'WIN_MAX', netAmount: 1.00 };
          return { status: 'LOSS', netAmount: -1.00 };
        }
      },
      'TRIPLICACAO_BLACK': {
        name: 'Triplicação (Alvo: PRETO)', stake: 1.00,
        evaluate: (num) => {
          if (num === 0) return { status: 'LOSS', netAmount: -1.00 };
          if (AutoSettlementEngine.BLACK_NUMS.includes(num)) return { status: 'WIN_MAX', netAmount: 1.00 };
          return { status: 'LOSS', netAmount: -1.00 };
        }
      },
      // TRIPLICAÇÃO - PARIDADES
      'TRIPLICACAO_EVEN': {
        name: 'Triplicação (Alvo: PAR)', stake: 1.00,
        evaluate: (num) => {
          if (num === 0) return { status: 'LOSS', netAmount: -1.00 };
          if (num % 2 === 0) return { status: 'WIN_MAX', netAmount: 1.00 };
          return { status: 'LOSS', netAmount: -1.00 };
        }
      },
      'TRIPLICACAO_ODD': {
        name: 'Triplicação (Alvo: ÍMPAR)', stake: 1.00,
        evaluate: (num) => {
          if (num === 0) return { status: 'LOSS', netAmount: -1.00 };
          if (num % 2 !== 0) return { status: 'WIN_MAX', netAmount: 1.00 };
          return { status: 'LOSS', netAmount: -1.00 };
        }
      }
    };
  }
}
module.exports = { AutoSettlementEngine };
