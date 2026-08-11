export interface ShadowPosition {
    readonly positionId: string;
    readonly sessionId: string;
    readonly strategy: string;
    readonly stakePercentage: number;
    readonly stakeValue: number;
    readonly entryRound: number;
    readonly result: 'WIN' | 'LOSS' | 'NO_TRADE' | 'BLOCKED';
    readonly profitLoss: number;
    readonly timestampUtc: string;
}
