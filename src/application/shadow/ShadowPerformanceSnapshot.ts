export interface StrategyPerformanceMetrics {
    readonly total: number;
    readonly wins: number;
    readonly winRate: number;
    readonly profitLoss: number;
}

export interface RegimePerformanceMetrics {
    readonly total: number;
    readonly wins: number;
    readonly winRate: number;
    readonly profitLoss: number;
}

export interface ShadowPerformanceSnapshot {
    readonly snapshotId: string;
    readonly sessionId: string;
    readonly timestampUtc: string;
    readonly initialBankroll: number;
    readonly currentBankroll: number;
    readonly totalSimulations: number;
    readonly wins: number;
    readonly losses: number;
    readonly winRate: number;
    readonly roi: number;
    readonly drawdown: number;
    readonly maxLossSequence: number;
    readonly bestStrategy: string;
    readonly strategyPerformance: Readonly<Record<string, StrategyPerformanceMetrics>>;
    readonly regimePerformance: Readonly<Record<string, RegimePerformanceMetrics>>;
    readonly snapshotHash: string;
}
