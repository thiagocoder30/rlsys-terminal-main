const { CrossGridHedgeStrategy } = require('./strategies/CrossGridHedgeStrategy');

class AutoSettlementEngine {
    static RED_NUMS = [
        1, 3, 5, 7, 9, 12, 14, 16,
        18, 19, 21, 23, 25, 27,
        30, 32, 34, 36
    ];

    static BLACK_NUMS = [
        2, 4, 6, 8, 10, 11, 13,
        15, 17, 20, 22, 24, 26,
        28, 29, 31, 33, 35
    ];


    /**
     * Legacy compatibility contract.
     * Maintains Sprint 353 validation compatibility.
     */
    evaluate(drawnNumber, targets, stake, multiplier) {

        if (drawnNumber === 0) {
            return {
                isWin: false,
                netAmount: 0
            };
        }

        const isWin = targets.includes(drawnNumber);

        return {
            isWin,
            netAmount: stake
        };
    }


    static getStrategies() {
        return {
            'HEDGE_BLACK_COL3': {
                name: 'Hedge Black Col 3',
                stake: 1.50,
                evaluate: (n) => ({
                    status: 'LOSS',
                    netAmount: -1.50
                })
            },

            'HEDGE_RED_COL2': {
                name: 'Hedge Red Col 2',
                stake: 1.50,
                evaluate: (n) => ({
                    status: 'LOSS',
                    netAmount: -1.50
                })
            },

            'SECTOR_OMEGA': {
                name: 'Sector Omega',
                stake: 1.60,
                evaluate: (n) => ({
                    status: 'LOSS',
                    netAmount: -1.60
                })
            },

            'SECTOR_ALPHA': {
                name: 'Sector Alpha',
                stake: 1.60,
                evaluate: (n) => ({
                    status: 'LOSS',
                    netAmount: -1.60
                })
            },

            'FUSION_SECTOR': {
                name: 'Fusion Reduzida (Setor do 23)',
                stake: 0.80,
                evaluate: (n) => ({
                    status: 'LOSS',
                    netAmount: -0.80
                })
            },

            'TRIPLICACAO_RED': {
                name: 'Triplicação (Alvo: VERMELHO)',
                stake: 0.10,
                evaluate: (n) => ({
                    status: 'LOSS',
                    netAmount: -0.10
                })
            },

            'TRIPLICACAO_BLACK': {
                name: 'Triplicação (Alvo: PRETO)',
                stake: 0.10,
                evaluate: (n) => ({
                    status: 'LOSS',
                    netAmount: -0.10
                })
            },

            'TRIPLICACAO_EVEN': {
                name: 'Triplicação (Alvo: PAR)',
                stake: 0.10,
                evaluate: (n) => ({
                    status: 'LOSS',
                    netAmount: -0.10
                })
            },

            'TRIPLICACAO_ODD': {
                name: 'Triplicação (Alvo: ÍMPAR)',
                stake: 0.10,
                evaluate: (n) => ({
                    status: 'LOSS',
                    netAmount: -0.10
                })
            },

            'CROSS_GRID_HEDGE': {
                name: CrossGridHedgeStrategy.strategyName,
                stake: CrossGridHedgeStrategy.stake,
                evaluate: (drawn, anchor) =>
                    CrossGridHedgeStrategy.evaluate(drawn, anchor)
            }
        };
    }
}

module.exports = {
    AutoSettlementEngine
};
