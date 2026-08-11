import { StrategyVote } from '../../domain/ensemble/StrategyVote';
import { ConsensusScore } from '../../domain/ensemble/ConsensusScore';
import { AgreementScore } from '../../domain/ensemble/AgreementScore';

export class ConsensusCalculator {
    public calculate(votes: Map<string, StrategyVote>, totalVotes: number): { 
        score: ConsensusScore, 
        agreement: AgreementScore,
        dominant: StrategyVote | null
    } {
        if (votes.size === 0 || totalVotes === 0) {
            return {
                score: { value: 0, level: 'WEAK' },
                agreement: { score: 0, percentage: 0 },
                dominant: null
            };
        }

        let dominant: StrategyVote | null = null;
        let maxWeight = -1;

        for (const vote of votes.values()) {
            if (vote.totalWeight > maxWeight) {
                maxWeight = vote.totalWeight;
                dominant = vote;
            }
        }

        if (!dominant) {
            return {
                score: { value: 0, level: 'WEAK' },
                agreement: { score: 0, percentage: 0 },
                dominant: null
            };
        }

        const percentage = (dominant.voteCount / totalVotes) * 100;
        const agreementScore = percentage;

        let level: 'WEAK' | 'MODERATE' | 'STRONG' | 'ABSOLUTE' = 'WEAK';
        if (percentage === 100) level = 'ABSOLUTE';
        else if (percentage >= 75) level = 'STRONG';
        else if (percentage >= 50) level = 'MODERATE';

        return {
            score: { value: dominant.totalWeight, level },
            agreement: { score: agreementScore, percentage },
            dominant
        };
    }
}
