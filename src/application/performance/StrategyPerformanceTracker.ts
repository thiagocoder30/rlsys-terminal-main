export interface StrategyMetricsAccumulator {
    issuedRecommendations: number;
    blockedRecommendations: number;
    holdRecommendations: number;
    totalConfidence: number;
    totalConsensus: number;
    totalVix: number;
    totalEntropy: number;
    shadowPnL: number;
    wins: number;
    totalExecutions: number;
}

export class StrategyPerformanceTracker {
    private issued = 0;
    private blocked = 0;
    private holds = 0;

    private confidenceSum = 0;
    private consensusSum = 0;
    private vixSum = 0;
    private entropySum = 0;
    private sampleCount = 0;

    private shadowPnL = 0;
    private correctCount = 0;
    private totalEvaluated = 0;

    private readonly strategyStats = new Map<string, StrategyMetricsAccumulator>();

    public recordRecommendation(
        status: string,
        confidence: number,
        consensus: number,
        vix: number,
        entropy: number,
        stake: number,
        strategyId: string | null
    ): void {
        if (status === 'RECOMMENDATION') {
            this.issued++;
        } else if (status === 'BLOCK') {
            this.blocked++;
        } else {
            this.holds++;
        }

        this.confidenceSum += confidence;
        this.consensusSum += consensus;
        this.vixSum += vix;
        this.entropySum += entropy;
        this.sampleCount++;

        if (strategyId) {
            let stats = this.strategyStats.get(strategyId);
            if (!stats) {
                stats = {
                    issuedRecommendations: 0,
                    blockedRecommendations: 0,
                    holdRecommendations: 0,
                    totalConfidence: 0,
                    totalConsensus: 0,
                    totalVix: 0,
                    totalEntropy: 0,
                    shadowPnL: 0,
                    wins: 0,
                    totalExecutions: 0
                };
                this.strategyStats.set(strategyId, stats);
            }
            if (status === 'RECOMMENDATION') stats.issuedRecommendations++;
            else if (status === 'BLOCK') stats.blockedRecommendations++;
            else stats.holdRecommendations++;

            stats.totalConfidence += confidence;
            stats.totalConsensus += consensus;
            stats.totalVix += vix;
            stats.totalEntropy += entropy;
        }
    }

    public recordOutcome(strategyId: string | null, isWin: boolean, pnlDelta: number): void {
        this.totalEvaluated++;
        if (isWin) this.correctCount++;
        this.shadowPnL += pnlDelta;

        if (strategyId) {
            const stats = this.strategyStats.get(strategyId);
            if (stats) {
                stats.totalExecutions++;
                if (isWin) stats.wins++;
                stats.shadowPnL += pnlDelta;
            }
        }
    }

    public getAverageConfidence(): number {
        return this.sampleCount > 0 ? this.confidenceSum / this.sampleCount : 0;
    }

    public getAverageConsensus(): number {
        return this.sampleCount > 0 ? this.consensusSum / this.sampleCount : 0;
    }

    public getAverageVix(): number {
        return this.sampleCount > 0 ? this.vixSum / this.sampleCount : 0;
    }

    public getAverageEntropy(): number {
        return this.sampleCount > 0 ? this.entropySum / this.sampleCount : 0;
    }

    public getIssuedCount(): number { return this.issued; }
    public getBlockedCount(): number { return this.blocked; }
    public getHoldCount(): number { return this.holds; }
    public getShadowPnL(): number { return this.shadowPnL; }

    public getAccuracy(): number {
        return this.totalEvaluated > 0 ? (this.correctCount / this.totalEvaluated) * 100 : 100;
    }

    public getStrategyRankings(): Array<{ strategyId: string; winRate: number; totalExecutions: number; rank: number }> {
        const list: Array<{ strategyId: string; winRate: number; totalExecutions: number }> = [];
        for (const [id, stats] of this.strategyStats.entries()) {
            const wr = stats.totalExecutions > 0 ? (stats.wins / stats.totalExecutions) * 100 : 50;
            list.push({ strategyId: id, winRate: wr, totalExecutions: stats.totalExecutions });
        }
        list.sort((a, b) => b.winRate - a.winRate);
        return list.map((item, idx) => ({ ...item, rank: idx + 1 }));
    }
}
