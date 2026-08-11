import { describe, it, expect } from 'vitest';
import { FeedbackGovernanceEngine } from '../../../src/application/feedback/FeedbackGovernanceEngine';
import { EvidenceValidationInput } from '../../../src/application/feedback/EvidenceValidator';
import { DecisionLedger } from '../../../src/application/runtime/DecisionLedger';

describe('FeedbackGovernanceEngine Unit Tests', () => {
    it('should evaluate evidence and return snapshot and decision', () => {
        const ledger = new DecisionLedger();
        const engine = new FeedbackGovernanceEngine(ledger);
        const input: EvidenceValidationInput = {
            evidenceType: 'SHADOW_PERFORMANCE',
            sampleSize: 50,
            qualityScore: 0.8,
            stabilityScore: 0.7,
            noiseLevel: 0.1,
            conflictLevel: 0.1,
            ledgerIntact: true,
            snapshotIntact: true
        };

        const result = engine.evaluateEvidence('SESSION-000', input);

        expect(result.snapshot).toBeDefined();
        expect(result.snapshot.validationStatus).toBe('APPROVED');
        expect(result.snapshot.hash).toBeDefined();

        expect(result.decision).toBeDefined();
        expect(result.decision.status).toBe('APPROVED');
        expect(result.decision.hash).toBeDefined();

        const entries = ledger.getEntries('SESSION-000');
        expect(entries.some(e => e.decisionSummary === 'FEEDBACK_EVIDENCE_APPROVED')).toBe(true);
        expect(entries.some(e => e.decisionSummary === 'FEEDBACK_GOVERNANCE_UPDATED')).toBe(true);
    });
});
