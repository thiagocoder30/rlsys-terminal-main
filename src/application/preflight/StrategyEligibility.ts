export interface StrategyEligibility {
    strategyId: string;
    status: 'ENABLED' | 'DISABLED' | 'LOCKED' | 'REJECTED';
    reason?: string;
}
