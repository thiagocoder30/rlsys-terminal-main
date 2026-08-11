import { StrategyContribution } from './PortfolioSnapshot';

export class PortfolioDiversificationCalculator {
    public calculateDiversification(contributions: StrategyContribution[]): number {
        if (contributions.length === 0) return 0;
        
        // Gini-Simpson Index or similar heuristic
        let sumSquares = 0;
        let total = 0;
        for (const c of contributions) {
            total += c.contributionScore;
        }
        
        if (total === 0) return 0;

        for (const c of contributions) {
            const p = c.contributionScore / total;
            sumSquares += p * p;
        }

        // 1 - sum(p^2)
        return 1.0 - sumSquares;
    }

    public calculateConcentration(contributions: StrategyContribution[]): number {
        if (contributions.length === 0) return 0;
        // Max weight
        let total = 0;
        let max = 0;
        for (const c of contributions) {
            total += c.contributionScore;
            if (c.contributionScore > max) {
                max = c.contributionScore;
            }
        }
        return total === 0 ? 0 : max / total;
    }
}
