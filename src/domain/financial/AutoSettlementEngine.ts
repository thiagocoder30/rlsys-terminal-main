export class AutoSettlementEngine {
    // Array estático dos números vermelhos da mesa
    public static RED_NUMS = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];

    public static getStrategies(): Record<string, any> {
        // Mock funcional de estratégias para o Allocation Engine
        const baseEvaluate = () => ({ status: 'WIN_MAX', netAmount: 1.5 });
        return {
            'CROSS_GRID_HEDGE': { name: 'Cross Grid Hedge (HFT)', stake: 1.0, evaluate: baseEvaluate },
            'FUSION_REDUZIDA': { name: 'Fusion Reduzida', stake: 0.5, evaluate: baseEvaluate },
            'TRIPLICACAO_RED': { name: 'Triplicação [RED]', stake: 0.5, evaluate: baseEvaluate },
            'TRIPLICACAO_BLACK': { name: 'Triplicação [BLACK]', stake: 0.5, evaluate: baseEvaluate },
            'TRIPLICACAO_EVEN': { name: 'Triplicação [PAR]', stake: 0.5, evaluate: baseEvaluate },
            'TRIPLICACAO_ODD': { name: 'Triplicação [ÍMPAR]', stake: 0.5, evaluate: baseEvaluate }
        };
    }
}
