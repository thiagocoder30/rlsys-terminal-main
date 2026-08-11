import { createHash, randomUUID } from 'crypto';
import { EvidenceValidator, EvidenceValidationInput } from './EvidenceValidator';
import { EvidenceSnapshot } from './EvidenceSnapshot';
import { FeedbackDecision } from './FeedbackDecision';
import { DecisionLedger } from '../runtime/DecisionLedger';

export class FeedbackGovernanceEngine {
    private validator = new EvidenceValidator();

    constructor(private readonly ledger?: DecisionLedger) {}

    public evaluateEvidence(
        sessionId: string,
        input: EvidenceValidationInput
    ): { snapshot: EvidenceSnapshot; decision: FeedbackDecision } {
        const validation = this.validator.validate(input);
        const timestamp = new Date().toISOString();
        const decisionId = randomUUID();

        // Create Snapshot Hash
        const rawSnapshotContent = `${timestamp}:${sessionId}:${input.evidenceType}:${input.sampleSize}:${validation.status}:${validation.reason}`;
        const snapshotHash = createHash('sha256').update(rawSnapshotContent).digest('hex');

        const snapshot: EvidenceSnapshot = Object.freeze({
            timestamp,
            sessionId,
            evidenceType: input.evidenceType,
            sampleSize: input.sampleSize,
            qualityScore: input.qualityScore,
            stabilityScore: input.stabilityScore,
            validationStatus: validation.status,
            reason: validation.reason,
            hash: snapshotHash
        });

        const rawDecisionContent = `${decisionId}:${sessionId}:${input.evidenceType}:${validation.status}:${validation.reason}`;
        const decisionHash = createHash('sha256').update(rawDecisionContent).digest('hex');

        const decision: FeedbackDecision = Object.freeze({
            decisionId,
            sessionId,
            evidenceType: input.evidenceType,
            status: validation.status,
            reason: validation.reason,
            timestamp,
            hash: decisionHash
        });

        // Audit in DecisionLedger
        if (this.ledger) {
            const eventName = validation.status === 'APPROVED' ? 'FEEDBACK_EVIDENCE_APPROVED' : 'FEEDBACK_EVIDENCE_REJECTED';
            this.ledger.append(sessionId, '5.0.0', eventName, JSON.stringify({
                evidenceType: input.evidenceType,
                reason: validation.reason,
                hash: decisionHash
            }));

            this.ledger.append(sessionId, '5.0.0', 'FEEDBACK_GOVERNANCE_UPDATED', JSON.stringify({
                status: validation.status,
                hash: snapshotHash
            }));
        }

        return { snapshot, decision };
    }
}
