export interface LearningSnapshot {
    snapshotId: string;
    timestamp: string;
    sessionId: string;
    performanceScore: number;
    knowledgeScore: number;
    feedbackScore: number;
    shadowScore: number;
    replayScore: number;
    regimeScore: number;
    calibrationScore: number;
    overallLearningIndex: number;
    learningStability: number;
    institutionalConfidence: number;
    hash: string;
}
