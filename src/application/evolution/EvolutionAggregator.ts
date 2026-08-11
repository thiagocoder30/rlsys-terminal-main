export class EvolutionAggregator {
    private learningScore = 0.5;
    private knowledgeScore = 0.5;
    private feedbackScore = 0.5;
    private shadowScore = 0.5;
    private performanceScore = 0.5;
    private regimeScore = 0.5;
    private calibrationScore = 0.5;
    private replayScore = 0.5;

    public updateLearning(payload: any): void {
        this.learningScore = payload?.overallLearningIndex ?? Math.min(this.learningScore + 0.05, 1.0);
    }
    public updateKnowledge(payload: any): void {
        this.knowledgeScore = Math.min(this.knowledgeScore + 0.05, 1.0);
    }
    public updateFeedback(payload: any): void {
        this.feedbackScore = Math.min(this.feedbackScore + 0.05, 1.0);
    }
    public updateShadow(payload: any): void {
        this.shadowScore = Math.min(this.shadowScore + 0.05, 1.0);
    }
    public updatePerformance(payload: any): void {
        this.performanceScore = Math.min(this.performanceScore + 0.05, 1.0);
    }
    public updateRegime(payload: any): void {
        this.regimeScore = Math.min(this.regimeScore + 0.05, 1.0);
    }
    public updateCalibration(payload: any): void {
        this.calibrationScore = Math.min(this.calibrationScore + 0.05, 1.0);
    }
    public updateReplay(payload: any): void {
        this.replayScore = Math.min(this.replayScore + 0.05, 1.0);
    }

    public getScores() {
        return {
            learningScore: this.learningScore,
            knowledgeScore: this.knowledgeScore,
            feedbackScore: this.feedbackScore,
            shadowScore: this.shadowScore,
            performanceScore: this.performanceScore,
            regimeScore: this.regimeScore,
            calibrationScore: this.calibrationScore,
            replayScore: this.replayScore
        };
    }
}
