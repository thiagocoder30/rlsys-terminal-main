import { describe, it, expect } from 'vitest';
import { EvidenceHistory } from '../../../src/application/feedback/EvidenceHistory';
import { EvidenceSnapshot } from '../../../src/application/feedback/EvidenceSnapshot';

describe('EvidenceHistory Unit Tests', () => {
    it('should append and retrieve history', () => {
        const history = new EvidenceHistory();
        const snapshot: EvidenceSnapshot = {
            timestamp: new Date().toISOString(),
            sessionId: 'SESSION-000',
            evidenceType: 'SHADOW_PERFORMANCE',
            sampleSize: 50,
            qualityScore: 0.8,
            stabilityScore: 0.7,
            validationStatus: 'APPROVED',
            reason: 'EVIDENCE_MEETS_INSTITUTIONAL_CRITERIA',
            hash: 'somehash'
        };

        history.append(snapshot);
        const retrieved = history.getHistory('SESSION-000');
        expect(retrieved.length).toBe(1);
        expect(retrieved[0].validationStatus).toBe('APPROVED');
        
        expect(history.getApprovedCount('SESSION-000')).toBe(1);
        expect(history.getRejectedCount('SESSION-000')).toBe(0);
        expect(history.getAverageQuality('SESSION-000')).toBe(0.8);
    });

    it('should respect max capacity', () => {
        const history = new EvidenceHistory();
        for (let i = 0; i < 110; i++) {
            history.append({
                timestamp: new Date().toISOString(),
                sessionId: 'SESSION-000',
                evidenceType: 'SHADOW_PERFORMANCE',
                sampleSize: 50,
                qualityScore: 0.8,
                stabilityScore: 0.7,
                validationStatus: 'APPROVED',
                reason: 'EVIDENCE_MEETS_INSTITUTIONAL_CRITERIA',
                hash: 'somehash'
            });
        }
        
        expect(history.getHistory('SESSION-000').length).toBe(100);
    });
});
