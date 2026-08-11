import { HistoricalSessionSnapshot } from './HistoricalSessionSnapshot';

export interface StrategyPerformanceSummary {
    strategyName: string;
    sessionsCount: number;
    totalWins: number;
    totalLosses: number;
    winRate: number;
    averageRoi: number;
    performanceScore: number;
}

export class StrategyPerformanceAnalyzer {
    public static analyze(snapshots: HistoricalSessionSnapshot[]): StrategyPerformanceSummary[] {
        const statsMap = new Map<string, { sessionsCount: number; wins: number; losses: number; totalRoi: number }>();

        for (const snapshot of snapshots) {
            for (const strategy of snapshot.data.strategiesUsed) {
                const current = statsMap.get(strategy) || { sessionsCount: 0, wins: 0, losses: 0, totalRoi: 0 };
                current.sessionsCount += 1;
                current.wins += snapshot.data.wins;
                current.losses += snapshot.data.losses;
                current.totalRoi += snapshot.data.roi;
                statsMap.set(strategy, current);
            }
        }

        const summaries: StrategyPerformanceSummary[] = [];

        for (const [strategyName, stats] of statsMap.entries()) {
            const totalRounds = stats.wins + stats.losses;
            const winRate = totalRounds > 0 ? stats.wins / totalRounds : 0;
            const averageRoi = stats.sessionsCount > 0 ? stats.totalRoi / stats.sessionsCount : 0;
            
            // Score from 0 to 100
            const score = Math.round(Math.max(0, Math.min(100, (winRate * 60) + (averageRoi * 200))));

            summaries.push({
                strategyName,
                sessionsCount: stats.sessionsCount,
                totalWins: stats.wins,
                totalLosses: stats.losses,
                winRate,
                averageRoi,
                performanceScore: score
            });
        }

        return summaries.sort((a, b) => b.performanceScore - a.performanceScore);
    }
}
