export interface EvidenceValidationInput {
    readonly evidenceType: string;
    readonly sampleSize: number;
    readonly qualityScore: number;
    readonly stabilityScore: number;
    readonly noiseLevel: number;
    readonly conflictLevel: number;
    readonly ledgerIntact: boolean;
    readonly snapshotIntact: boolean;
}

export interface ValidationResult {
    readonly status: 'APPROVED' | 'REJECTED';
    readonly reason: string;
}

export class EvidenceValidator {
    public validate(input: EvidenceValidationInput): ValidationResult {
        if (!input.ledgerIntact) {
            return { status: 'REJECTED', reason: 'LEDGER_COMPROMISED' };
        }
        if (!input.snapshotIntact) {
            return { status: 'REJECTED', reason: 'SNAPSHOT_CORRUPTED' };
        }
        if (input.sampleSize < 30) {
            return { status: 'REJECTED', reason: 'INSUFFICIENT_SAMPLE_SIZE' };
        }
        if (input.qualityScore < 0.6) {
            return { status: 'REJECTED', reason: 'LOW_QUALITY_SCORE' };
        }
        if (input.stabilityScore < 0.5) {
            return { status: 'REJECTED', reason: 'LOW_STABILITY_SCORE' };
        }
        if (input.noiseLevel > 0.4) {
            return { status: 'REJECTED', reason: 'EXCESSIVE_NOISE' };
        }
        if (input.conflictLevel > 0.3) {
            return { status: 'REJECTED', reason: 'EXCESSIVE_CONFLICT' };
        }

        return { status: 'APPROVED', reason: 'EVIDENCE_MEETS_INSTITUTIONAL_CRITERIA' };
    }
}
