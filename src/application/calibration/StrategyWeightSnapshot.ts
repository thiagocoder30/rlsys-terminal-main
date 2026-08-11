export interface StrategyWeightItem {
    readonly strategyId: string;
    readonly dynamicWeight: number; // 0..1 or 0..100 normalized
    readonly confidence: number;
    readonly consensus: number;
    readonly shadowPnL: number;
    readonly winRate: number;
    readonly totalExecutions: number;
    readonly trend: 'UPWARD' | 'STABLE' | 'DOWNWARD';
}

export interface StrategyWeightSnapshot {
    readonly snapshotId: string;
    readonly sessionId: string;
    readonly timestampUtc: string;
    readonly weights: ReadonlyArray<StrategyWeightItem>;
    readonly marketRegime: string;
    readonly sessionQuality: number;
    readonly drawdown: number;
    readonly snapshotHash: string;
}
