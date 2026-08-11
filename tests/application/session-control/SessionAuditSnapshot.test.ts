import { describe, it, expect } from 'vitest';
import { SessionAuditSnapshot } from '../../../src/application/session-control/SessionAuditSnapshot';

describe('SessionAuditSnapshot', () => {
    it('should generate consistent hash and be immutable', () => {
        const data = {
            sessionId: 'TEST-123',
            startTime: '2026-07-28T10:00:00Z',
            endTime: '2026-07-28T11:00:00Z',
            initialBankroll: 1000,
            finalBankroll: 1200,
            totalRounds: 50,
            totalSuggestions: 10,
            confirmedSuggestions: 5,
            skippedSuggestions: 5,
            wins: 3,
            losses: 2,
            roi: 0.2,
            stopReason: 'MANUAL',
            strategyPerformance: {}
        };

        const snapshot1 = new SessionAuditSnapshot(data);
        const snapshot2 = new SessionAuditSnapshot(data);

        expect(snapshot1.hash).toBeDefined();
        expect(snapshot1.hash).toBe(snapshot2.hash);

        expect(Object.isFrozen(snapshot1)).toBe(true);
    });
});
