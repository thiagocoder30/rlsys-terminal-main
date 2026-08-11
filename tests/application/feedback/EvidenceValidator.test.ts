import { describe, it, expect } from 'vitest';
import { EvidenceValidator, EvidenceValidationInput } from '../../../src/application/feedback/EvidenceValidator';

describe('EvidenceValidator Unit Tests', () => {
    const validator = new EvidenceValidator();

    const baseInput: EvidenceValidationInput = {
        evidenceType: 'SHADOW_PERFORMANCE',
        sampleSize: 50,
        qualityScore: 0.8,
        stabilityScore: 0.7,
        noiseLevel: 0.1,
        conflictLevel: 0.1,
        ledgerIntact: true,
        snapshotIntact: true
    };

    it('should approve valid evidence', () => {
        const result = validator.validate(baseInput);
        expect(result.status).toBe('APPROVED');
        expect(result.reason).toBe('EVIDENCE_MEETS_INSTITUTIONAL_CRITERIA');
    });

    it('should reject if ledger is compromised', () => {
        const result = validator.validate({ ...baseInput, ledgerIntact: false });
        expect(result.status).toBe('REJECTED');
        expect(result.reason).toBe('LEDGER_COMPROMISED');
    });

    it('should reject if snapshot is corrupted', () => {
        const result = validator.validate({ ...baseInput, snapshotIntact: false });
        expect(result.status).toBe('REJECTED');
        expect(result.reason).toBe('SNAPSHOT_CORRUPTED');
    });

    it('should reject if sample size is insufficient', () => {
        const result = validator.validate({ ...baseInput, sampleSize: 20 });
        expect(result.status).toBe('REJECTED');
        expect(result.reason).toBe('INSUFFICIENT_SAMPLE_SIZE');
    });

    it('should reject if quality score is low', () => {
        const result = validator.validate({ ...baseInput, qualityScore: 0.5 });
        expect(result.status).toBe('REJECTED');
        expect(result.reason).toBe('LOW_QUALITY_SCORE');
    });

    it('should reject if stability score is low', () => {
        const result = validator.validate({ ...baseInput, stabilityScore: 0.4 });
        expect(result.status).toBe('REJECTED');
        expect(result.reason).toBe('LOW_STABILITY_SCORE');
    });
    
    it('should reject if noise level is excessive', () => {
        const result = validator.validate({ ...baseInput, noiseLevel: 0.5 });
        expect(result.status).toBe('REJECTED');
        expect(result.reason).toBe('EXCESSIVE_NOISE');
    });
    
    it('should reject if conflict level is excessive', () => {
        const result = validator.validate({ ...baseInput, conflictLevel: 0.4 });
        expect(result.status).toBe('REJECTED');
        expect(result.reason).toBe('EXCESSIVE_CONFLICT');
    });
});
