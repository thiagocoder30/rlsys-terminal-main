export interface SessionSnapshot {
    readonly sessionId: string;
    readonly timestampUtc: string;
    readonly runtimeVersion: string;
    readonly bankroll: number;
    readonly peakBankroll: number;
    readonly drawdown: number;
    readonly operationalVix: number;
    readonly strategyWeights: Readonly<Record<string, number>>;
    readonly shadowPnL: Readonly<Record<string, number>>;
    readonly burnIn: number;
    readonly cooldown: number;
    readonly oracleState: string;
    readonly lockState: boolean;
}
