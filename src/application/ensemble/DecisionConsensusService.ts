import { EnsembleDecisionEngine } from './EnsembleDecisionEngine';
import { EnsembleSnapshotManager } from './EnsembleSnapshotManager';
import { ModelVote } from '../../domain/ensemble/ModelVote';
import { DecisionConsensus } from '../../domain/ensemble/DecisionConsensus';

export class DecisionConsensusService {
    constructor(
        private readonly engine: EnsembleDecisionEngine,
        private readonly snapshotManager: EnsembleSnapshotManager
    ) {}

    public processVotes(votes: ModelVote[]): DecisionConsensus {
        const consensus = this.engine.evaluate(votes);
        this.snapshotManager.append(consensus);
        return consensus;
    }
}
