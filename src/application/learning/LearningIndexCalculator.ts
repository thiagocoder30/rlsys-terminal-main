export class LearningIndexCalculator {
    public calculateOverallIndex(
        performanceScore: number,
        knowledgeScore: number,
        feedbackScore: number,
        shadowScore: number,
        replayScore: number,
        regimeScore: number,
        calibrationScore: number
    ): number {
        return (performanceScore + knowledgeScore + feedbackScore + shadowScore + replayScore + regimeScore + calibrationScore) / 7;
    }

    public calculateStability(overallIndex: number): number {
        return Math.min(overallIndex * 1.05, 1.0);
    }

    public calculateInstitutionalConfidence(
        knowledgeScore: number,
        feedbackScore: number,
        shadowScore: number
    ): number {
        return (knowledgeScore * 1.5 + feedbackScore * 1.2 + shadowScore) / 3.7;
    }
}
