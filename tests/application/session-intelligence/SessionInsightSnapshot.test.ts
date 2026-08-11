import { describe, it, expect } from 'vitest';
import { SessionInsightSnapshot } from '../../../src/application/session-intelligence/SessionInsightSnapshot';

describe('SessionInsightSnapshot', () => {
    it('should create frozen snapshot with valid SHA-256 hash', () => {
        const snapshot = new SessionInsightSnapshot({
            timestamp: 1700000000000,
            operatorProfile: {
                operatorId: 'OP-001',
                totalSessions: 5,
                totalRounds: 50,
                averageROI: 0.15,
                averageWinRate: 0.6,
                averageStake: 25,
                averageDrawdown: 0.05,
                bestStrategy: 'Dozen 1',
                worstStrategy: 'Column 3',
                consistencyScore: 82,
                riskLevel: 'LOW_RISK',
                trend: 'IMPROVING'
            },
            riskLevel: 'LOW_RISK',
            consistencyScore: 82,
            trend: 'IMPROVING',
            insights: ['Excelente disciplina operacional.']
        });

        expect(snapshot.data.operatorProfile.operatorId).toBe('OP-001');
        expect(snapshot.hash).toBeDefined();
        expect(snapshot.hash.length).toBe(64);
        expect(Object.isFrozen(snapshot)).toBe(true);
        expect(Object.isFrozen(snapshot.data)).toBe(true);
    });
});
