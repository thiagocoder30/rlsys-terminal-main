export interface StakeRecommendationInput {
    readonly bankroll: number;
    readonly confidence: number;
    readonly consensusLevel: number;
    readonly riskLevel: number; // 0 to 1
    readonly adaptiveScore: number;
    readonly minChipValue?: number;
    readonly strategyCoverage?: number;
}

export class StakeRecommendationService {
    // Hard limit: 5% of bankroll max
    private readonly MAX_STAKE_PERCENTAGE = 0.05;
    private readonly DEFAULT_MIN_CHIP = 0.50;

    public calculateStake(input: StakeRecommendationInput): number {
        if (!input.bankroll || input.bankroll <= 0) return 0;
        
        const fivePercentCap = input.bankroll * 0.05;
        const minimumChipValue = input.minChipValue && input.minChipValue > 0 ? input.minChipValue : this.DEFAULT_MIN_CHIP;
        const strategyChipCount = input.strategyCoverage && input.strategyCoverage > 0 ? input.strategyCoverage : 1;

        const minimumCost = strategyChipCount * minimumChipValue;
        if (minimumCost > fivePercentCap) return 0;

        const maxMultiplier = Math.floor(fivePercentCap / minimumCost);
        if (maxMultiplier < 1) return 0;

        const finalStake = minimumCost * maxMultiplier;
        return Math.round(finalStake * 100) / 100;
    }
}

