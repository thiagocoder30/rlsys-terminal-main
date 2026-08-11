export interface ConsensusMetrics {
    consensusRate: number;
    averageAgreementScore: number;
    averageConflictScore: number;
    ensembleConfidence: number;
    consensusDrift: number;
    totalDecisions: number;
}
