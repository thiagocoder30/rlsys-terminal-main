import { createHash } from 'crypto';
import { StrategyConfidence } from '../../domain/adaptive/StrategyConfidence';

export interface StrategyConfidenceLedgerEntry {
    readonly snapshotId: string;
    readonly strategyId: string;
    readonly timestampUtc: string;
    readonly confidenceData: string; // JSON string of StrategyConfidence
    readonly integrityHash: string;
}

export class StrategyConfidenceRepository {
    private ledger: StrategyConfidenceLedgerEntry[] = [];

    public append(
        strategyId: string,
        confidence: StrategyConfidence
    ): StrategyConfidenceLedgerEntry {
        const snapshotId = crypto.randomUUID();
        const timestampUtc = new Date().toISOString();
        const confidenceData = JSON.stringify(confidence);
        
        const rawData = `${snapshotId}:${strategyId}:${timestampUtc}:${confidenceData}`;
        const integrityHash = createHash('sha256').update(rawData).digest('hex');

        const entry: StrategyConfidenceLedgerEntry = Object.freeze({
            snapshotId,
            strategyId,
            timestampUtc,
            confidenceData,
            integrityHash
        });

        this.ledger.push(entry);
        return entry;
    }

    public getEntries(strategyId?: string): ReadonlyArray<StrategyConfidenceLedgerEntry> {
        if (strategyId) {
            return this.ledger.filter(e => e.strategyId === strategyId);
        }
        return this.ledger;
    }

    public getLatest(strategyId: string): StrategyConfidence | null {
        const entries = this.ledger.filter(e => e.strategyId === strategyId);
        if (entries.length === 0) return null;
        const latest = entries[entries.length - 1];
        return JSON.parse(latest.confidenceData) as StrategyConfidence;
    }

    public getCount(): number {
        return this.ledger.length;
    }
}
