export interface TacticalExecutionRequest {
    readonly sessionId: string;
    readonly value: number;
    readonly bankroll: number;
    readonly provider: 'EVOLUTION' | 'PRAGMATIC';
    readonly isSkip: boolean;
}
