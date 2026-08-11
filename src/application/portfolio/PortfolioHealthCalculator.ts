export class PortfolioHealthCalculator {
    public calculateHealth(
        diversification: number,
        concentration: number,
        confidence: number,
        correlation: number
    ): number {
        // Simple health calculation
        const base = (diversification * 0.4) + (confidence * 0.4) + ((1.0 - correlation) * 0.2);
        const penalty = concentration > 0.8 ? 0.2 : 0;
        return Math.max(0, Math.min(1, base - penalty));
    }
}
