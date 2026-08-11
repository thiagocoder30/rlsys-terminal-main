export interface StrategyContribution {
    strategyId: string;
    contributionScore: number;
}

export interface RegimeExposure {
    regime: string;
    exposurePercentage: number;
}

export interface PortfolioSnapshot {
    snapshotId: string;
    timestamp: string;
    sessionId: string;
    portfolioHealth: number;
    diversificationIndex: number;
    concentrationIndex: number;
    portfolioConfidence: number;
    correlationMatrix: Record<string, number>;
    riskDistribution: Record<string, number>;
    strategyContributions: StrategyContribution[];
    regimeExposure: RegimeExposure[];
    hash: string;
}
