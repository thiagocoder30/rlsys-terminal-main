export interface StrategyStatRecord {
    issued: number;
    blocked: number;
    approved: number;
    shadowPnL: number;
    totalConfidence: number;
    totalConsensus: number;
    sampleCount: number;
    wins: number;
    totalExecutions: number;
    currentWeight: number;
    previousWeight: number;
}

export class StrategyWeightTracker {
    private readonly stats = new Map<string, StrategyStatRecord>();
    private lastUpdateUtc: string = new Date().toISOString();

    public recordStrategyObservation(
        strategyId: string,
        status: 'RECOMMENDATION' | 'BLOCK' | 'HOLD',
        confidence: number,
        consensus: number,
        pnlDelta: number = 0,
        isWin?: boolean
    ): void {
        let record = this.stats.get(strategyId);
        if (!record) {
            record = {
                issued: 0,
                blocked: 0,
                approved: 0,
                shadowPnL: 0,
                totalConfidence: 0,
                totalConsensus: 0,
                sampleCount: 0,
                wins: 0,
                totalExecutions: 0,
                currentWeight: 1.0,
                previousWeight: 1.0
            };
            this.stats.set(strategyId, record);
        }

        if (status === 'RECOMMENDATION') record.approved++;
        else if (status === 'BLOCK') record.blocked++;
        else record.issued++;

        record.totalConfidence += confidence;
        record.totalConsensus += consensus;
        record.sampleCount++;
        record.shadowPnL += pnlDelta;

        if (isWin !== undefined) {
            record.totalExecutions++;
            if (isWin) record.wins++;
        }

        this.lastUpdateUtc = new Date().toISOString();
    }

    public updateWeight(strategyId: string, newWeight: number): void {
        const record = this.stats.get(strategyId);
        if (record) {
            record.previousWeight = record.currentWeight;
            record.currentWeight = newWeight;
        }
    }

    public getRecord(strategyId: string): StrategyStatRecord | undefined {
        return this.stats.get(strategyId);
    }

    public getAllRecords(): Map<string, StrategyStatRecord> {
        return this.stats;
    }

    public getLastUpdateUtc(): string {
        return this.lastUpdateUtc;
    }
}
