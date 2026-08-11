export class ZScoreAnalyzer {
    public calculateZScore(pnlHistory: number[]): number {
        if (pnlHistory.length < 5) return 0;
        const mean = pnlHistory.reduce((a, b) => a + b, 0) / pnlHistory.length;
        const variance = pnlHistory.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / pnlHistory.length;
        const stdDev = Math.sqrt(variance);
        if (stdDev === 0) return 0;
        const latestPnL = pnlHistory[pnlHistory.length - 1];
        return (latestPnL - mean) / stdDev;
    }
}
