import { InstitutionalEvidence } from '../InstitutionalDecisionAggregator';

export class InstitutionalConsensusCalculator {
    public calculate(evidence: InstitutionalEvidence): number {
        const values = [
            evidence.replayConsistency,
            evidence.predictionConfidence,
            evidence.portfolioHealth,
            evidence.learningIndex,
            evidence.knowledgeCoverage,
            evidence.evolutionIndex,
            evidence.strategyMaturity
        ];
        
        const sum = values.reduce((a, b) => a + b, 0);
        const mean = sum / values.length;
        
        const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length;
        
        const consensus = 1.0 - Math.min(variance * 4, 1.0);
        return Math.min(Math.max(consensus, 0.0), 1.0);
    }
}
