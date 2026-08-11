export interface CalculatedPerformanceMetrics {
    roi: number;
    winRate: number;
    confirmationRate: number;
    utilizationRate: number;
    overallScore: number;
}

export class PerformanceMetricsCalculator {
    public static calculate(
        initialBankroll: number,
        finalBankroll: number,
        totalRounds: number,
        confirmedSuggestions: number,
        skippedSuggestions: number,
        wins: number,
        losses: number
    ): CalculatedPerformanceMetrics {
        const profitLoss = finalBankroll - initialBankroll;
        const roi = initialBankroll > 0 ? profitLoss / initialBankroll : 0;
        const winRate = totalRounds > 0 ? wins / totalRounds : 0;
        
        const totalSuggestions = confirmedSuggestions + skippedSuggestions;
        const confirmationRate = totalSuggestions > 0 ? confirmedSuggestions / totalSuggestions : 0;
        const utilizationRate = confirmedSuggestions > 0 ? wins / confirmedSuggestions : 0;

        // Overall Score (0 - 100) based on ROI, Win Rate, and Confirmation Rate
        const roiScore = Math.max(0, Math.min(40, (roi + 0.2) * 100)); // 20% ROI gives full 40 pts
        const winRateScore = Math.min(40, winRate * 40);
        const confirmationScore = Math.min(20, confirmationRate * 20);

        const overallScore = Math.round(Math.max(0, Math.min(100, roiScore + winRateScore + confirmationScore)));

        return {
            roi,
            winRate,
            confirmationRate,
            utilizationRate,
            overallScore
        };
    }
}
