import { InstitutionalEvidence } from '../InstitutionalDecisionAggregator';

export interface HealthIndicators {
    operationalReadiness: number;
    evidenceStability: number;
    knowledgeCoverage: number;
    strategyStability: number;
    predictionQuality: number;
    portfolioStability: number;
    institutionalHealth: number;
}

export class InstitutionalHealthCalculator {
    public calculate(evidence: InstitutionalEvidence): HealthIndicators {
        const operationalReadiness = (evidence.shadowAccuracy + evidence.replayConsistency) / 2;
        const evidenceStability = (evidence.learningIndex + evidence.evolutionIndex) / 2;
        const knowledgeCoverage = evidence.knowledgeCoverage;
        const strategyStability = evidence.strategyMaturity;
        const predictionQuality = evidence.predictionConfidence;
        const portfolioStability = evidence.portfolioHealth;

        const institutionalHealth = (
            operationalReadiness * 0.3 +
            evidenceStability * 0.2 +
            strategyStability * 0.2 +
            predictionQuality * 0.15 +
            portfolioStability * 0.15
        );

        return {
            operationalReadiness,
            evidenceStability,
            knowledgeCoverage,
            strategyStability,
            predictionQuality,
            portfolioStability,
            institutionalHealth: Math.min(Math.max(institutionalHealth, 0.0), 1.0)
        };
    }
}
