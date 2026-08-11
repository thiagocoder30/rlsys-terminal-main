export type SessionHealthStatus = 'EXCELLENT' | 'GOOD' | 'STABLE' | 'DEGRADED' | 'CRITICAL';
export type ConfidenceTrendDirection = 'UPWARD' | 'STABLE' | 'DOWNWARD';
export type ConsensusTrendDirection = 'EXPANDING' | 'STABLE' | 'CONTRACTING';

export interface StrategyRankingItem {
    readonly strategyId: string;
    readonly winRate: number;
    readonly totalExecutions: number;
    readonly rank: number;
}

export interface PerformanceSnapshot {
    readonly snapshotId: string;
    readonly sessionId: string;
    readonly timestampUtc: string;
    readonly sessionHealth: SessionHealthStatus;
    readonly confidenceTrend: ConfidenceTrendDirection;
    readonly consensusTrend: ConsensusTrendDirection;
    readonly averageRecommendationScore: number;
    readonly averageStake: number;
    readonly averageVix: number;
    readonly averageEntropy: number;
    readonly shadowPnL: number;
    readonly drawdown: number;
    readonly runtimeUptimeSeconds: number;
    readonly recommendationAccuracy: number;
    readonly strategyRanking: ReadonlyArray<StrategyRankingItem>;
    readonly sessionQualityScore: number;
    readonly operationalStabilityIndex: number;
}
