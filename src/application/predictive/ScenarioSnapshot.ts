export interface ScenarioSnapshot {
    snapshotId: string;
    timestamp: string;
    sessionId: string;
    dominantScenario: string;
    confidence: number;
    probabilityDistribution: Record<string, number>;
    knowledgeVersion: string;
    learningIndex: number;
    evolutionIndex: number;
    hash: string;
}
