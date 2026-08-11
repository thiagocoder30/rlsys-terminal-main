import { StrategyLifecycleStatus } from './StrategyEvolutionRecommendation';

export class StrategyLifecycleEvaluator {
    public evaluateLifecycle(
        maturity: number,
        portfolioContribution: number,
        riskScore: number,
        predictiveStability: number
    ): StrategyLifecycleStatus {
        if (maturity > 0.8 && portfolioContribution > 0.7 && riskScore < 0.3 && predictiveStability > 0.8) {
            return 'PROMOTE';
        }
        if (maturity < 0.2 && riskScore > 0.9) {
            return 'RETIRE';
        }
        if (maturity < 0.3 || (portfolioContribution < 0.2 && riskScore > 0.7)) {
            return 'DEPRECATE';
        }
        if (riskScore > 0.5 || predictiveStability < 0.5) {
            return 'WATCH';
        }
        return 'KEEP';
    }
}
