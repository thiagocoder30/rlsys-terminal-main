export class ShadowPortfolio {
    private readonly initialBankroll: number;
    private currentBankroll: number;
    private peakBankroll: number;
    private totalTrades: number = 0;
    private wins: number = 0;
    private losses: number = 0;
    private currentLossSequence: number = 0;
    private maxLossSequence: number = 0;

    constructor(initialBankroll: number = 10000) {
        this.initialBankroll = Math.max(1, initialBankroll);
        this.currentBankroll = this.initialBankroll;
        this.peakBankroll = this.initialBankroll;
    }

    /**
     * Records a simulated trade in O(1) time complexity without reprocessing full session history.
     */
    public recordTrade(profitLoss: number, isWin: boolean | null): void {
        if (profitLoss === 0 && isWin === null) {
            // NO_TRADE or BLOCKED
            return;
        }

        this.totalTrades++;
        this.currentBankroll = Math.max(0, Math.round((this.currentBankroll + profitLoss) * 100) / 100);

        if (this.currentBankroll > this.peakBankroll) {
            this.peakBankroll = this.currentBankroll;
        }

        if (isWin === true || profitLoss > 0) {
            this.wins++;
            this.currentLossSequence = 0;
        } else if (isWin === false || profitLoss < 0) {
            this.losses++;
            this.currentLossSequence++;
            if (this.currentLossSequence > this.maxLossSequence) {
                this.maxLossSequence = this.currentLossSequence;
            }
        }
    }

    public getInitialBankroll(): number {
        return this.initialBankroll;
    }

    public getCurrentBankroll(): number {
        return this.currentBankroll;
    }

    public getTotalTrades(): number {
        return this.totalTrades;
    }

    public getWins(): number {
        return this.wins;
    }

    public getLosses(): number {
        return this.losses;
    }

    public getWinRate(): number {
        if (this.totalTrades === 0) return 0;
        return Math.round((this.wins / this.totalTrades) * 1000) / 10; // e.g. 65.5%
    }

    public getRoi(): number {
        const diff = this.currentBankroll - this.initialBankroll;
        return Math.round((diff / this.initialBankroll) * 10000) / 100; // e.g. +12.5%
    }

    public getDrawdown(): number {
        if (this.peakBankroll <= 0) return 0;
        const diff = this.peakBankroll - this.currentBankroll;
        if (diff <= 0) return 0;
        return Math.round((diff / this.peakBankroll) * 10000) / 100; // e.g. 5.2%
    }

    public getMaxLossSequence(): number {
        return this.maxLossSequence;
    }

    public getCurrentLossSequence(): number {
        return this.currentLossSequence;
    }
}
