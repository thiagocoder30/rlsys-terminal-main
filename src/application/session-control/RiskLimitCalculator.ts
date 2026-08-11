export class RiskLimitCalculator {
    public calculateStopLossLimit(initialBankroll: number): number {
        // Default: 15% stop loss
        return initialBankroll * 0.85;
    }

    public calculateStopWinLimit(initialBankroll: number): number {
        // Default: 30% stop win
        return initialBankroll * 1.30;
    }
}
