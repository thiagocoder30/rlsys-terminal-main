export type StrategyLifecycleStatus = 'PROMOTE' | 'KEEP' | 'WATCH' | 'DEPRECATE' | 'RETIRE';

export interface StrategyEvolutionRecommendation {
    recommendationId: string;
    strategyId: string;
    action: StrategyLifecycleStatus;
    confidence: number;
    evidenceScore: number;
    riskScore: number;
    historicalSupport: number;
    timestamp: string;
    hash: string;
}
