export interface StrategyDTO {
    strategyId: string;
    name: string;
    status: 'ENABLED' | 'DISABLED' | 'LOCKED';
    confidence: number;
    shadowWeight: number;
    ranking: number;
    lastResult: string;
}
