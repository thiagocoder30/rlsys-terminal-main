import { ModelVote } from '../../domain/ensemble/ModelVote';
import { DecisionConsensus } from '../../domain/ensemble/DecisionConsensus';
import { WeightedVotingEngine } from './WeightedVotingEngine';
import { ConsensusCalculator } from './ConsensusCalculator';
import { DecisionConflictAnalyzer } from './DecisionConflictAnalyzer';
import { randomUUID, createHash } from 'crypto';

export class EnsembleDecisionEngine {
    constructor(
        private readonly votingEngine: WeightedVotingEngine,
        private readonly consensusCalculator: ConsensusCalculator,
        private readonly conflictAnalyzer: DecisionConflictAnalyzer
    ) {}

    public evaluate(votes: ModelVote[]): DecisionConsensus {
        const strategyVotes = this.votingEngine.calculateVotes(votes);
        const validVotesCount = votes.filter(v => v.suggestedStrategy !== null).length;
        
        const { score, agreement, dominant } = this.consensusCalculator.calculate(strategyVotes, validVotesCount);
        const { level, score: conflictScore } = this.conflictAnalyzer.analyze(strategyVotes, validVotesCount);

        const consensusId = randomUUID();
        const timestampUtc = new Date().toISOString();

        const dom = dominant ? {
            strategyId: dominant.strategyId,
            weight: dominant.totalWeight,
            confidence: dominant.averageConfidence
        } : null;

        const consensus: DecisionConsensus = {
            consensusId,
            timestampUtc,
            votes,
            dominantStrategy: dom,
            score,
            conflictLevel: level,
            agreement
        };

        const rawData = `${consensusId}:${timestampUtc}:${JSON.stringify(dom)}:${score.value}:${level}`;
        consensus.integrityHash = createHash('sha256').update(rawData).digest('hex');

        return consensus;
    }
}
