export class StrategyMaturityCalculator {
    public calculateMaturityIndex(
        historicalSupport: number,
        learningIndex: number,
        evolutionIndex: number,
        persistenceIndex: number
    ): number {
        const maturity = (historicalSupport * 0.4) + (learningIndex * 0.2) + (evolutionIndex * 0.2) + (persistenceIndex * 0.2);
        return Math.min(Math.max(maturity, 0.0), 1.0);
    }
}
