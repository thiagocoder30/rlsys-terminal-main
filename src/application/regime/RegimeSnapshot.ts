export type MarketRegimeType = 'TRENDING' | 'MEAN_REVERSION' | 'BALANCED' | 'CHAOTIC' | 'LOW_INFORMATION';

export interface RegimeSnapshot {
    readonly snapshotId: string;
    readonly sessionId: string;
    readonly timestampUtc: string;
    readonly currentRegime: MarketRegimeType;
    readonly previousRegime: MarketRegimeType | null;
    readonly stabilityIndex: number;
    readonly confidenceScore: number;
    readonly persistenceCount: number;
    readonly transitionCount: number;
    readonly eligibleStrategyFamilies: ReadonlyArray<string>;
    readonly indicatorsUsed: {
        readonly vix: number;
        readonly entropy: number;
        readonly confidence: number;
        readonly consensus: number;
    };
    readonly snapshotHash: string;
}
