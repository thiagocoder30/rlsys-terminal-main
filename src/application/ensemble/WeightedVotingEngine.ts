import { ModelVote } from '../../domain/ensemble/ModelVote';
import { StrategyVote } from '../../domain/ensemble/StrategyVote';

export class WeightedVotingEngine {
    public calculateVotes(modelVotes: ModelVote[]): Map<string, StrategyVote> {
        const strategyVotes = new Map<string, StrategyVote>();

        for (const vote of modelVotes) {
            if (!vote.suggestedStrategy) continue;
            
            const current = strategyVotes.get(vote.suggestedStrategy) || {
                strategyId: vote.suggestedStrategy,
                totalWeight: 0,
                voteCount: 0,
                averageConfidence: 0
            };

            current.totalWeight += vote.weight;
            current.voteCount += 1;
            // Calculate moving average for confidence
            current.averageConfidence = current.averageConfidence + (vote.confidence - current.averageConfidence) / current.voteCount;
            
            strategyVotes.set(vote.suggestedStrategy, current);
        }

        return strategyVotes;
    }
}
