import { createHash } from 'crypto';

export interface HistoricalSessionData {
    sessionId: string;
    startTime: number;
    endTime: number;
    initialBankroll: number;
    finalBankroll: number;
    profitLoss: number;
    roi: number;
    totalRounds: number;
    confirmedSuggestions: number;
    skippedSuggestions: number;
    wins: number;
    losses: number;
    stopReason: string;
    strategiesUsed: readonly string[];
    performanceScore: number;
}

export class HistoricalSessionSnapshot {
    public readonly data: Readonly<HistoricalSessionData>;
    public readonly hash: string;

    constructor(data: HistoricalSessionData) {
        this.data = Object.freeze({
            ...data,
            strategiesUsed: Object.freeze([...data.strategiesUsed])
        });
        this.hash = this.generateHash();
        Object.freeze(this);
    }

    private generateHash(): string {
        return createHash('sha256')
            .update(JSON.stringify(this.data))
            .digest('hex');
    }
}
