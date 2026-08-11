export interface TacticalExecutionRequest {
    readonly sessionId: string;
    readonly bankroll: number;
    readonly provider: string;
    readonly recentSpins: number[];
    readonly tacticalMetadata?: Record<string, unknown>;
}
