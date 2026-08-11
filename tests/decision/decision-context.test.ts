import { DecisionContext } from '../../src/decision/DecisionContext';

describe('DecisionContext Contract (DEV000.4-001)', () => {
    it('deve satisfazer o formato e restrições da interface DecisionContext', () => {
        const context: DecisionContext = {
            sessionId: 'SESSION_TEST_001',
            timestamp: Date.now(),
            timeline: [0, 32, 15, 19],
            bankroll: 55.00,
            baseBankroll: 55.00,
            vix: 22.4,
            markovMatrix: [[0, 1], [1, 0]],
            strategyPerformance: {
                'ZONE_TIERS': { pnl: 5.0, weight: 1.5, wins: 3, losses: 1 }
            },
            cooldown: 0,
            burnIn: 0,
            provider: 'PRAGMATIC'
        };

        expect(context.sessionId).toBe('SESSION_TEST_001');
        expect(context.timeline).toHaveLength(4);
        expect(context.strategyPerformance['ZONE_TIERS'].weight).toBe(1.5);
    });
});

