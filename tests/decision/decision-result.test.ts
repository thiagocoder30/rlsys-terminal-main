import { DecisionResult } from '../../src/decision/DecisionResult';

describe('DecisionResult Contract (DEV000.4-001)', () => {
    it('deve satisfazer o formato e restrições da interface DecisionResult', () => {
        const result: DecisionResult = {
            approved: true,
            strategy: 'ZONE_TIERS',
            confidence: 0.91,
            stake: 2.50,
            reason: 'Z-Score e Entropia dentro dos limites operacionais seguros.',
            analysis: {
                entropy: 0.42,
                zScore: 2.15,
                markovConfidence: 0.88,
                sectorConcentration: 0.35
            },
            timestamp: Date.now()
        };

        expect(result.approved).toBe(true);
        expect(result.strategy).toBe('ZONE_TIERS');
        expect(result.confidence).toBe(0.91);
        expect(result.analysis.zScore).toBe(2.15);
    });
});

