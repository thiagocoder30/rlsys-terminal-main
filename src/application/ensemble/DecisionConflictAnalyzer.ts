import { StrategyVote } from '../../domain/ensemble/StrategyVote';
import { ConflictLevel } from '../../domain/ensemble/ConflictLevel';

export class DecisionConflictAnalyzer {
    public analyze(votes: Map<string, StrategyVote>, totalVotes: number): { level: ConflictLevel, score: number } {
        if (votes.size === 0 || totalVotes === 0) return { level: 'NONE', score: 0 };
        if (votes.size === 1) return { level: 'NONE', score: 0 };

        const distribution = Array.from(votes.values()).map(v => v.voteCount / totalVotes);
        
        let sumSquares = 0;
        for (const p of distribution) {
            sumSquares += p * p;
        }
        
        const conflictScore = (1 - sumSquares) * 100;

        let level: ConflictLevel = 'NONE';
        if (conflictScore > 75) level = 'CRITICAL';
        else if (conflictScore > 50) level = 'HIGH';
        else if (conflictScore > 25) level = 'MEDIUM';
        else if (conflictScore > 0) level = 'LOW';

        return { level, score: conflictScore };
    }
}
