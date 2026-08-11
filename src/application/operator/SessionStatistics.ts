export interface SessionStatisticsDTO {
    readonly totalSpins: number;
    readonly totalRecommendations: number;
    readonly totalHolds: number;
    readonly totalBlocks: number;
    readonly averageVix: number;
    readonly averageEntropy: number;
    readonly averageConsensus: number;
    readonly averageStake: number;
    readonly shadowPnL: number;
    readonly currentBankroll: number;
    readonly drawdown: number;
    readonly hitRate: number;
    readonly confidence: number;
}

export class SessionStatistics {
    private totalSpinsCount = 0;
    private totalRecommendationsCount = 0;
    private totalHoldsCount = 0;
    private totalBlocksCount = 0;

    private sumVix = 0;
    private sumEntropy = 0;
    private sumConsensus = 0;
    private sumStake = 0;

    private accumulatedShadowPnL = 0;
    private initialBankroll = 1000;
    private bankrollCurrent = 1000;
    private bankrollPeak = 1000;

    private totalWins = 0;
    private totalEvaluatedResults = 0;
    private latestConfidenceScore = 0;

    constructor(initialBankroll = 1000) {
        this.initialBankroll = initialBankroll;
        this.bankrollCurrent = initialBankroll;
        this.bankrollPeak = initialBankroll;
    }

    public recordSpin(input: {
        drawnNumber: number;
        operationalVix: number;
        entropy: number;
        consensus: number;
        status: 'RECOMMENDATION' | 'HOLD' | 'BLOCK' | 'APPROVED' | string;
        stake: number;
        pnlDelta?: number;
        currentBankroll: number;
        isWin?: boolean;
        confidence: number;
    }): void {
        this.totalSpinsCount++;
        this.sumVix += input.operationalVix;
        this.sumEntropy += input.entropy;
        this.sumConsensus += input.consensus;
        this.sumStake += input.stake;
        this.latestConfidenceScore = input.confidence;

        if (input.status === 'RECOMMENDATION') {
            this.totalRecommendationsCount++;
        } else if (input.status === 'BLOCK' || input.status === 'REJECTED') {
            this.totalBlocksCount++;
        } else {
            this.totalHoldsCount++;
        }

        if (typeof input.pnlDelta === 'number') {
            this.accumulatedShadowPnL += input.pnlDelta;
        }

        this.bankrollCurrent = input.currentBankroll;
        if (this.bankrollCurrent > this.bankrollPeak) {
            this.bankrollPeak = this.bankrollCurrent;
        }

        if (typeof input.isWin === 'boolean') {
            this.totalEvaluatedResults++;
            if (input.isWin) {
                this.totalWins++;
            }
        }
    }

    public getStatistics(): SessionStatisticsDTO {
        const count = this.totalSpinsCount;
        const avgVix = count > 0 ? this.sumVix / count : 0;
        const avgEntropy = count > 0 ? this.sumEntropy / count : 0;
        const avgConsensus = count > 0 ? this.sumConsensus / count : 0;
        const avgStake = count > 0 ? this.sumStake / count : 0;

        const drawdown = this.bankrollPeak > 0 && this.bankrollCurrent < this.bankrollPeak
            ? ((this.bankrollPeak - this.bankrollCurrent) / this.bankrollPeak) * 100
            : 0;

        const hitRate = this.totalEvaluatedResults > 0
            ? (this.totalWins / this.totalEvaluatedResults) * 100
            : 0;

        return Object.freeze({
            totalSpins: this.totalSpinsCount,
            totalRecommendations: this.totalRecommendationsCount,
            totalHolds: this.totalHoldsCount,
            totalBlocks: this.totalBlocksCount,
            averageVix: Number(avgVix.toFixed(2)),
            averageEntropy: Number(avgEntropy.toFixed(4)),
            averageConsensus: Number(avgConsensus.toFixed(4)),
            averageStake: Number(avgStake.toFixed(2)),
            shadowPnL: Number(this.accumulatedShadowPnL.toFixed(2)),
            currentBankroll: Number(this.bankrollCurrent.toFixed(2)),
            drawdown: Number(drawdown.toFixed(2)),
            hitRate: Number(hitRate.toFixed(2)),
            confidence: Number(this.latestConfidenceScore.toFixed(2))
        });
    }

    public reset(initialBankroll = 1000): void {
        this.totalSpinsCount = 0;
        this.totalRecommendationsCount = 0;
        this.totalHoldsCount = 0;
        this.totalBlocksCount = 0;
        this.sumVix = 0;
        this.sumEntropy = 0;
        this.sumConsensus = 0;
        this.sumStake = 0;
        this.accumulatedShadowPnL = 0;
        this.initialBankroll = initialBankroll;
        this.bankrollCurrent = initialBankroll;
        this.bankrollPeak = initialBankroll;
        this.totalWins = 0;
        this.totalEvaluatedResults = 0;
        this.latestConfidenceScore = 0;
    }
}
