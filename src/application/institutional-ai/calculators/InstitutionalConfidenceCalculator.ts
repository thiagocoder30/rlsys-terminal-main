import { InstitutionalEvidence } from '../InstitutionalDecisionAggregator';

export class InstitutionalConfidenceCalculator {
    public calculate(evidence: InstitutionalEvidence): number {
        const {
            learningIndex,
            evolutionIndex,
            knowledgeCoverage,
            portfolioHealth,
            replayConsistency,
            shadowAccuracy,
            predictionConfidence
        } = evidence;

        const confidence = (
            learningIndex * 0.15 +
            evolutionIndex * 0.15 +
            knowledgeCoverage * 0.1 +
            portfolioHealth * 0.1 +
            replayConsistency * 0.1 +
            shadowAccuracy * 0.2 +
            predictionConfidence * 0.2
        );
        return Math.min(Math.max(confidence, 0.0), 1.0);
    }
}
