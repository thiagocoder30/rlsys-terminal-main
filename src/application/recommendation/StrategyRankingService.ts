import { StrategyRankingDTO } from './dto/OperationalDecisionDTO';

export interface StrategyPerformanceMetrics {
    readonly strategyId: string;
    readonly confidenceScore: number;
    readonly winRate: number;
    readonly recentPnL: number;
}

export class StrategyRankingService {
    public rank(strategies: StrategyPerformanceMetrics[]): StrategyRankingDTO[] {
        if (!strategies || strategies.length === 0) {
            return [];
        }

        // Calculates a composite score based on confidence, winRate, and recent PnL
        const scored = strategies.map(s => {
            const normalizedPnL = s.recentPnL > 0 ? Math.min(s.recentPnL / 100, 1) : 0;
            const score = Math.round((s.confidenceScore * 0.5 + s.winRate * 100 * 0.3 + normalizedPnL * 100 * 0.2));
            return {
                strategyId: s.strategyId,
                score: Math.max(0, Math.min(100, score))
            };
        });

        scored.sort((a, b) => b.score - a.score);

        return scored.map((s, index) => ({
            strategyId: s.strategyId,
            score: s.score,
            rank: index + 1
        }));
    }
}
