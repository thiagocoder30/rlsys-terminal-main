export interface InstitutionalDecisionSnapshot {
    snapshotId: string;
    timestamp: string;
    overallIntelligenceScore: number;
    institutionalConfidence: number;
    institutionalConsensus: number;
    institutionalHealth: number;
    knowledgeCoverage: number;
    learningIndex: number;
    evolutionIndex: number;
    portfolioHealth: number;
    predictionConfidence: number;
    strategyMaturity: number;
    shadowAccuracy: number;
    replayConsistency: number;
    evidenceQuality: number;
    operationalReadiness: number;
    portfolioDiversification: number;
    hash: string;
}
