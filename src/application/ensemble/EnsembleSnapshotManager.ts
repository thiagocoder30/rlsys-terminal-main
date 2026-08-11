import { DecisionConsensus } from '../../domain/ensemble/DecisionConsensus';
import { ConsensusMetrics } from '../../domain/ensemble/ConsensusMetrics';

export class EnsembleSnapshotManager {
    private snapshots: DecisionConsensus[] = [];
    private metrics: ConsensusMetrics = {
        consensusRate: 0,
        averageAgreementScore: 0,
        averageConflictScore: 0,
        ensembleConfidence: 0,
        consensusDrift: 0,
        totalDecisions: 0
    };
    
    private totalConflictScore = 0;
    private totalAgreementScore = 0;
    private totalConfidence = 0;
    private consensusCount = 0;

    public append(consensus: DecisionConsensus): void {
        this.snapshots.push(consensus);
        this.metrics.totalDecisions++;
        
        if (consensus.score.level === 'STRONG' || consensus.score.level === 'ABSOLUTE') {
            this.consensusCount++;
        }
        
        this.totalAgreementScore += consensus.agreement.score;
        
        let conflictVal = 0;
        if (consensus.conflictLevel === 'LOW') conflictVal = 25;
        if (consensus.conflictLevel === 'MEDIUM') conflictVal = 50;
        if (consensus.conflictLevel === 'HIGH') conflictVal = 75;
        if (consensus.conflictLevel === 'CRITICAL') conflictVal = 100;
        
        this.totalConflictScore += conflictVal;
        
        if (consensus.dominantStrategy) {
            this.totalConfidence += consensus.dominantStrategy.confidence;
        }

        this.updateMetrics();
    }

    public getHistory(limit?: number): ReadonlyArray<DecisionConsensus> {
        if (limit && limit > 0) {
            return this.snapshots.slice(-limit);
        }
        return this.snapshots;
    }

    public getMetrics(): ConsensusMetrics {
        return this.metrics;
    }
    
    public getLatest(): DecisionConsensus | null {
        if (this.snapshots.length === 0) return null;
        return this.snapshots[this.snapshots.length - 1];
    }

    private updateMetrics() {
        const t = this.metrics.totalDecisions;
        if (t === 0) return;
        
        this.metrics.consensusRate = (this.consensusCount / t) * 100;
        this.metrics.averageAgreementScore = this.totalAgreementScore / t;
        this.metrics.averageConflictScore = this.totalConflictScore / t;
        this.metrics.ensembleConfidence = this.totalConfidence / t;
    }
}
