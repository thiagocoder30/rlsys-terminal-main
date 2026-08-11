export interface IntelligenceExecutionResult {
    readonly newTimeline: ReadonlyArray<number>;
    readonly shadowWeights: Readonly<Record<string, number>>;
    readonly shadowPnL: Readonly<Record<string, number>>;
    readonly vix: number;
    readonly preFlightStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
    readonly preFlightReason: string;
    readonly isLocked: boolean;
    readonly lockReason: string;
    readonly activeStrategy: string | null;
    readonly activeStake: number;
    readonly auditReason: string;
    readonly oracleMessage: string;
    readonly peakBankroll: number;
}
