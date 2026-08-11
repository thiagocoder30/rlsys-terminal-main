export class EvolutionIndexCalculator {
    public calculateEvolution(
        learningScore: number,
        knowledgeScore: number,
        feedbackScore: number,
        shadowScore: number,
        performanceScore: number,
        regimeScore: number,
        calibrationScore: number,
        replayScore: number
    ) {
        const institutionalIntelligenceIndex = (learningScore + knowledgeScore + feedbackScore) / 3;
        const learningEfficiency = learningScore * 1.1;
        const knowledgeGrowth = knowledgeScore * 1.05;
        const adaptiveStability = (calibrationScore + regimeScore) / 2;
        const decisionQualityTrend = (performanceScore + shadowScore + replayScore) / 3;
        const operationalEvolutionScore = (institutionalIntelligenceIndex + adaptiveStability + decisionQualityTrend) / 3;

        return {
            institutionalIntelligenceIndex: Math.min(institutionalIntelligenceIndex, 1.0),
            learningEfficiency: Math.min(learningEfficiency, 1.0),
            knowledgeGrowth: Math.min(knowledgeGrowth, 1.0),
            adaptiveStability: Math.min(adaptiveStability, 1.0),
            decisionQualityTrend: Math.min(decisionQualityTrend, 1.0),
            operationalEvolutionScore: Math.min(operationalEvolutionScore, 1.0)
        };
    }
}
