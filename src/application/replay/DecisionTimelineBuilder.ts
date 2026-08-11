import { DecisionTimelineEntry } from './DecisionReplaySnapshot';
import { DecisionLedgerEntry } from '../runtime/DecisionLedger';
import { createHash } from 'crypto';

export class DecisionTimelineBuilder {
    public build(entries: ReadonlyArray<DecisionLedgerEntry>): DecisionTimelineEntry[] {
        return entries.map(entry => {
            const raw = `${entry.timestampUtc}:${entry.decisionSummary}:${entry.decisionExplanation}:${entry.integrityHash}`;
            const hash = createHash('sha256').update(raw).digest('hex');

            return {
                timestamp: entry.timestampUtc,
                event: entry.decisionSummary,
                description: this.getDescriptionForEvent(entry),
                reference: entry.decisionId,
                hash
            };
        });
    }

    private getDescriptionForEvent(entry: DecisionLedgerEntry): string {
        try {
            // Try to parse explanation as JSON, if it is a JSON string
            const parsed = JSON.parse(entry.decisionExplanation);
            if (parsed && typeof parsed === 'object') {
                return JSON.stringify(parsed);
            }
        } catch {
            // Not JSON
        }
        return entry.decisionExplanation || entry.decisionSummary;
    }
}
