import crypto from 'crypto';

export class SessionAuditSnapshot {
    public readonly sessionId: string;
    public readonly startTime: string;
    public readonly endTime: string;
    public readonly initialBankroll: number;
    public readonly finalBankroll: number;
    public readonly totalRounds: number;
    public readonly totalSuggestions: number;
    public readonly confirmedSuggestions: number;
    public readonly skippedSuggestions: number;
    public readonly wins: number;
    public readonly losses: number;
    public readonly roi: number;
    public readonly stopReason: string;
    public readonly strategyPerformance: Record<string, any>;
    public readonly hash: string;

    constructor(data: Omit<SessionAuditSnapshot, 'hash'>) {
        this.sessionId = data.sessionId;
        this.startTime = data.startTime;
        this.endTime = data.endTime;
        this.initialBankroll = data.initialBankroll;
        this.finalBankroll = data.finalBankroll;
        this.totalRounds = data.totalRounds;
        this.totalSuggestions = data.totalSuggestions;
        this.confirmedSuggestions = data.confirmedSuggestions;
        this.skippedSuggestions = data.skippedSuggestions;
        this.wins = data.wins;
        this.losses = data.losses;
        this.roi = data.roi;
        this.stopReason = data.stopReason;
        this.strategyPerformance = data.strategyPerformance;

        this.hash = this.generateHash();
        Object.freeze(this);
    }

    private generateHash(): string {
        const payload = JSON.stringify({
            sessionId: this.sessionId,
            startTime: this.startTime,
            endTime: this.endTime,
            initialBankroll: this.initialBankroll,
            finalBankroll: this.finalBankroll,
            totalRounds: this.totalRounds,
            totalSuggestions: this.totalSuggestions,
            confirmedSuggestions: this.confirmedSuggestions,
            skippedSuggestions: this.skippedSuggestions,
            wins: this.wins,
            losses: this.losses,
            roi: this.roi,
            stopReason: this.stopReason,
            strategyPerformance: this.strategyPerformance
        });
        return crypto.createHash('sha256').update(payload).digest('hex');
    }
}
