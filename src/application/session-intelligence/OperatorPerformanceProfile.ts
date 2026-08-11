export interface OperatorPerformanceProfile {
    operatorId: string;
    totalSessions: number;
    totalRounds: number;
    averageROI: number;
    averageWinRate: number;
    averageStake: number;
    averageDrawdown: number;
    bestStrategy: string | null;
    worstStrategy: string | null;
    consistencyScore: number;
    riskLevel: 'LOW_RISK' | 'NORMAL' | 'ATTENTION' | 'HIGH_RISK';
    trend: 'IMPROVING' | 'STABLE' | 'DECLINING';
}
