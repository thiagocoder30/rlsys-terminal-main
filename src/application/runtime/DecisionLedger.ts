import { createHash } from 'crypto';

export interface DecisionLedgerEntry {
    readonly decisionId: string;
    readonly sessionId: string;
    readonly timestampUtc: string;
    readonly runtimeVersion: string;
    readonly decisionSummary: string;
    readonly decisionExplanation: string;
    readonly integrityHash: string;
}

export class DecisionLedger {
    private ledger: DecisionLedgerEntry[] = [];

    public append(
        sessionId: string,
        runtimeVersion: string,
        decisionSummary: string,
        decisionExplanation: string
    ): DecisionLedgerEntry {
        const decisionId = crypto.randomUUID();
        const timestampUtc = new Date().toISOString();
        
        const rawData = `${decisionId}:${sessionId}:${timestampUtc}:${runtimeVersion}:${decisionSummary}:${decisionExplanation}`;
        const integrityHash = createHash('sha256').update(rawData).digest('hex');

        const entry: DecisionLedgerEntry = Object.freeze({
            decisionId,
            sessionId,
            timestampUtc,
            runtimeVersion,
            decisionSummary,
            decisionExplanation,
            integrityHash
        });

        this.ledger.push(entry);
        return entry;
    }

    public getEntries(sessionId: string): ReadonlyArray<DecisionLedgerEntry> {
        return this.ledger.filter(e => e.sessionId === sessionId);
    }

    public getDecisionCount(): number {
        return this.ledger.length;
    }
}
