export interface StrategyPerformance {
    strategyId: string;
    totalExecutions: number;
    wins: number;
    losses: number;
    winRate: number;
    averageDrawdown: number;
    averageProfit: number;
    cumulativeProfit: number;
    volatility: number;
    averageTime: number;
    stability: number;
}
