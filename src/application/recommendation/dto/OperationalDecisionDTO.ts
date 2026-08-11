export interface StrategyRankingDTO {
    readonly strategyId: string;
    readonly score: number;
    readonly rank: number;
}

export interface OperationalDecisionDTO {
    readonly isOpportunity: boolean;
    readonly strategy: string | null;
    readonly ranking: StrategyRankingDTO[];
    readonly confidence: number;
    readonly consensus: number;
    readonly risk: number;
    readonly stake: number;
    readonly bankroll: number;
    readonly adaptiveScore: number;
    readonly ensembleScore: number;
    readonly preFlightStatus: 'APPROVED' | 'REJECTED';
    readonly explanation: string;
    readonly lockReason: string | null;
    readonly generatedAt: string;
}
