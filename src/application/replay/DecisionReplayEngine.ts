import { createHash } from 'crypto';
import { DecisionLedger, DecisionLedgerEntry } from '../runtime/DecisionLedger';
import { DecisionReplaySnapshot } from './DecisionReplaySnapshot';
import { DecisionTimelineBuilder } from './DecisionTimelineBuilder';
import { DecisionExplanationEngine } from './DecisionExplanationEngine';

export class DecisionReplayEngine {
    private timelineBuilder = new DecisionTimelineBuilder();
    private explanationEngine = new DecisionExplanationEngine();

    constructor(private readonly ledger: DecisionLedger) {}

    public reconstruct(decisionId: string, sessionId: string = 'SESSION-000'): DecisionReplaySnapshot | null {
        const allEntries = this.ledger.getEntries(sessionId);
        
        // Find the target decision entry to use as anchor
        const targetIndex = allEntries.findIndex(e => e.decisionId === decisionId);
        
        // If not found by ID, we could just replay all of them, but let's stick to the ones up to the target
        let relevantEntries: ReadonlyArray<DecisionLedgerEntry> = allEntries;
        if (targetIndex !== -1) {
            // We take a window of entries leading up to this decision
            // In a real system we'd use correlation IDs. Here we just take the last 20 entries up to the target
            const startIndex = Math.max(0, targetIndex - 20);
            relevantEntries = allEntries.slice(startIndex, targetIndex + 1);
        } else {
            return null; // Target decision not found
        }

        const timeline = this.timelineBuilder.build(relevantEntries);
        const explanation = this.explanationEngine.explain(relevantEntries);
        
        const timestamp = new Date().toISOString();
        
        const targetEntry = allEntries[targetIndex];
        const decisionHash = targetEntry.integrityHash;

        const rawData = `${decisionId}:${sessionId}:${timestamp}:${decisionHash}`;
        const hash = createHash('sha256').update(rawData).digest('hex');

        // Append to ledger for audit
        this.ledger.append(sessionId, '5.0.0', 'DECISION_REPLAY_CREATED', JSON.stringify({ decisionId, hash }));
        this.ledger.append(sessionId, '5.0.0', 'DECISION_TIMELINE_BUILT', JSON.stringify({ items: timeline.length }));
        this.ledger.append(sessionId, '5.0.0', 'DECISION_EXPLAINED', JSON.stringify({ strategy: explanation.chosenStrategy }));

        return Object.freeze({
            decisionId,
            sessionId,
            timestamp,
            timeline,
            explanation,
            decisionHash,
            hash
        });
    }
}
