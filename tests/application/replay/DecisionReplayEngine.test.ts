import { describe, it, expect } from 'vitest';
import { DecisionReplayEngine } from '../../../src/application/replay/DecisionReplayEngine';
import { DecisionLedger } from '../../../src/application/runtime/DecisionLedger';

describe('DecisionReplayEngine Unit Tests', () => {
    it('should reconstruct decision and return snapshot', () => {
        const ledger = new DecisionLedger();
        
        // Add some mock entries
        ledger.append('SESSION-000', '5.0.0', 'MARKET_REGIME_UPDATED', JSON.stringify({ regime: 'TRENDING' }));
        const targetEntry = ledger.append('SESSION-000', '5.0.0', 'RECOMMENDATION_GENERATED', JSON.stringify({ strategy: 'MARTINGALE', confidence: 0.8 }));
        
        const engine = new DecisionReplayEngine(ledger);
        
        const snapshot = engine.reconstruct(targetEntry.decisionId, 'SESSION-000');
        
        expect(snapshot).toBeDefined();
        if (snapshot) {
            expect(snapshot.decisionId).toBe(targetEntry.decisionId);
            expect(snapshot.timeline.length).toBeGreaterThan(0);
            expect(snapshot.explanation.chosenStrategy).toBe('MARTINGALE');
            expect(snapshot.explanation.marketRegime).toBe('TRENDING');
            expect(snapshot.hash).toBeDefined();
            
            // Should have appended audit events
            const allEntries = ledger.getEntries('SESSION-000');
            expect(allEntries.some(e => e.decisionSummary === 'DECISION_REPLAY_CREATED')).toBe(true);
            expect(allEntries.some(e => e.decisionSummary === 'DECISION_TIMELINE_BUILT')).toBe(true);
            expect(allEntries.some(e => e.decisionSummary === 'DECISION_EXPLAINED')).toBe(true);
        }
    });

    it('should return null for non-existent replay', () => {
        const ledger = new DecisionLedger();
        const engine = new DecisionReplayEngine(ledger);
        const snapshot = engine.reconstruct('does-not-exist', 'SESSION-000');
        expect(snapshot).toBeNull();
    });
});
