import { StrategyPerformance } from '../../domain/adaptive/StrategyPerformance';

export class StrategyPerformanceHistory {
    private history: Map<string, StrategyPerformance> = new Map();

    public recordExecution(strategyId: string, isWin: boolean, profit: number, drawdown: number, timeSpent: number): void {
        const perf = this.history.get(strategyId) || this.createInitial(strategyId);

        perf.totalExecutions += 1;
        if (isWin) {
            perf.wins += 1;
        } else {
            perf.losses += 1;
        }
        perf.winRate = perf.wins / perf.totalExecutions;

        // moving average
        perf.averageProfit = perf.averageProfit + (profit - perf.averageProfit) / perf.totalExecutions;
        perf.averageDrawdown = perf.averageDrawdown + (drawdown - perf.averageDrawdown) / perf.totalExecutions;
        perf.averageTime = perf.averageTime + (timeSpent - perf.averageTime) / perf.totalExecutions;

        perf.cumulativeProfit += profit;
        
        // Volatility approximation
        const currentVolatility = Math.abs(profit - perf.averageProfit);
        perf.volatility = (perf.volatility + currentVolatility) / 2;
        
        // Stability estimation
        perf.stability = (perf.winRate * 100) / (1 + perf.volatility);

        this.history.set(strategyId, perf);
    }

    public getPerformance(strategyId: string): StrategyPerformance | undefined {
        return this.history.get(strategyId);
    }

    public getAllPerformances(): StrategyPerformance[] {
        return Array.from(this.history.values());
    }

    private createInitial(strategyId: string): StrategyPerformance {
        return {
            strategyId,
            totalExecutions: 0,
            wins: 0,
            losses: 0,
            winRate: 0,
            averageDrawdown: 0,
            averageProfit: 0,
            cumulativeProfit: 0,
            volatility: 0,
            averageTime: 0,
            stability: 100
        };
    }
}
