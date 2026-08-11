export class LearningAggregator {
    private currentPerformanceScore = 0.5;
    private currentKnowledgeScore = 0.5;
    private currentFeedbackScore = 0.5;
    private currentShadowScore = 0.5;
    private currentReplayScore = 0.5;
    private currentRegimeScore = 0.5;
    private currentCalibrationScore = 0.5;

    public updatePerformanceScore(payload: any): void {
        this.currentPerformanceScore = Math.min(this.currentPerformanceScore + 0.05, 1.0);
    }
    public updateKnowledgeScore(payload: any): void {
        this.currentKnowledgeScore = Math.min(this.currentKnowledgeScore + 0.05, 1.0);
    }
    public updateFeedbackScore(payload: any): void {
        this.currentFeedbackScore = Math.min(this.currentFeedbackScore + 0.05, 1.0);
    }
    public updateShadowScore(payload: any): void {
        this.currentShadowScore = Math.min(this.currentShadowScore + 0.05, 1.0);
    }
    public updateReplayScore(payload: any): void {
        this.currentReplayScore = Math.min(this.currentReplayScore + 0.05, 1.0);
    }
    public updateRegimeScore(payload: any): void {
        this.currentRegimeScore = Math.min(this.currentRegimeScore + 0.05, 1.0);
    }
    public updateCalibrationScore(payload: any): void {
        this.currentCalibrationScore = Math.min(this.currentCalibrationScore + 0.05, 1.0);
    }

    public getScores() {
        return {
            performanceScore: this.currentPerformanceScore,
            knowledgeScore: this.currentKnowledgeScore,
            feedbackScore: this.currentFeedbackScore,
            shadowScore: this.currentShadowScore,
            replayScore: this.currentReplayScore,
            regimeScore: this.currentRegimeScore,
            calibrationScore: this.currentCalibrationScore
        };
    }
}
