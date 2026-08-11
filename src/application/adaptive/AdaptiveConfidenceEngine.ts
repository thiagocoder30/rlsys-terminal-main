import { DecisionLedger } from '../runtime/DecisionLedger';
import { RuntimeTelemetry } from '../runtime/RuntimeTelemetry';
import { StrategyPerformanceHistory } from './StrategyPerformanceHistory';
import { StrategyConfidence } from '../../domain/adaptive/StrategyConfidence';
import { ConfidenceScore } from '../../domain/adaptive/ConfidenceScore';
import { ConfidenceTrend } from '../../domain/adaptive/ConfidenceTrend';
import { ConfidenceMetrics } from '../../domain/adaptive/ConfidenceMetrics';

export class AdaptiveConfidenceEngine {
    constructor(
        private readonly ledger: DecisionLedger,
        private readonly telemetry: RuntimeTelemetry,
        private readonly performanceHistory: StrategyPerformanceHistory
    ) {}

    public evaluateConfidence(strategyId: string): StrategyConfidence {
        const perf = this.performanceHistory.getPerformance(strategyId);

        if (!perf || perf.totalExecutions === 0) {
            return this.getDefaultConfidence(strategyId);
        }

        const scoreValue = this.calculateScoreValue(perf.winRate, perf.stability);
        const score: ConfidenceScore = {
            value: scoreValue,
            level: this.determineLevel(scoreValue)
        };

        const volatility = perf.volatility;
        const stability = perf.stability;
        const trend = this.calculateTrend(perf.cumulativeProfit, perf.averageProfit);
        const recovery = this.calculateRecovery(perf.losses, perf.wins);

        return {
            strategyId,
            score,
            trend,
            volatility,
            stability,
            recovery,
            lastUpdated: Date.now()
        };
    }

    public getAggregateMetrics(): ConfidenceMetrics {
        const all = this.performanceHistory.getAllPerformances();
        if (all.length === 0) {
            return { averageConfidence: 50, trend: 'STABLE', volatility: 0, recoveryCount: 0, stability: 100 };
        }

        let totalWinRate = 0;
        let totalStability = 0;
        let totalVolatility = 0;

        for (const perf of all) {
            totalWinRate += perf.winRate;
            totalStability += perf.stability;
            totalVolatility += perf.volatility;
        }

        const avgWinRate = totalWinRate / all.length;
        const avgStability = totalStability / all.length;
        const averageConfidence = this.calculateScoreValue(avgWinRate, avgStability);
        const volatility = totalVolatility / all.length;
        
        return {
            averageConfidence,
            trend: 'STABLE',
            volatility,
            recoveryCount: 0,
            stability: avgStability
        };
    }

    private calculateScoreValue(winRate: number, stability: number): number {
        const score = (winRate * 100 * 0.7) + (stability * 0.3);
        return Math.min(Math.max(score, 0), 100);
    }

    private determineLevel(score: number): 'CRITICAL' | 'LOW' | 'MEDIUM' | 'HIGH' | 'MAXIMUM' {
        if (score >= 90) return 'MAXIMUM';
        if (score >= 70) return 'HIGH';
        if (score >= 50) return 'MEDIUM';
        if (score >= 30) return 'LOW';
        return 'CRITICAL';
    }

    private calculateTrend(cumulativeProfit: number, averageProfit: number): ConfidenceTrend {
        if (cumulativeProfit > 0 && averageProfit > 0) return 'UP';
        if (cumulativeProfit < 0 && averageProfit < 0) return 'DOWN';
        return 'STABLE';
    }

    private calculateRecovery(losses: number, wins: number): number {
        if (losses === 0) return 100;
        return (wins / losses) * 50;
    }

    private getDefaultConfidence(strategyId: string): StrategyConfidence {
        return {
            strategyId,
            score: { value: 50, level: 'MEDIUM' },
            trend: 'STABLE',
            volatility: 0,
            stability: 100,
            recovery: 100,
            lastUpdated: Date.now()
        };
    }
}
