import { describe, it, expect } from 'vitest';
import { DecisionExplanationEngine } from '../../../src/application/replay/DecisionExplanationEngine';
import { DecisionLedger } from '../../../src/application/runtime/DecisionLedger';

describe('DecisionExplanationEngine Unit Tests', () => {
    it('should extract correct explanation fields from entries deterministically', () => {
        const ledger = new DecisionLedger();
        
        ledger.append('SESSION-000', '5.0.0', 'MARKET_REGIME_UPDATED', JSON.stringify({ regime: 'CHAOTIC' }));
        ledger.append('SESSION-000', '5.0.0', 'VIX_CALCULATED', JSON.stringify({ vix: 0.85 }));
        ledger.append('SESSION-000', '5.0.0', 'RECOMMENDATION_GENERATED', JSON.stringify({ 
            strategy: 'FIBONACCI', 
            confidence: 0.9,
            consensus: 0.8,
            stake: 10
        }));
        
        const engine = new DecisionExplanationEngine();
        const explanation = engine.explain([...ledger.getEntries('SESSION-000')]);
        
        expect(explanation.marketRegime).toBe('CHAOTIC');
        expect(explanation.operationalVix).toBe(0.85);
        expect(explanation.chosenStrategy).toBe('FIBONACCI');
        expect(explanation.confidence).toBe(0.9);
        expect(explanation.consensus).toBe(0.8);
        expect(explanation.suggestedStake).toBe(10);
        expect(explanation.primaryReason).toContain('FIBONACCI');
        expect(explanation.institutionalConclusion).toBe('Decision approved based on objective institutional metrics.');
    });
});
