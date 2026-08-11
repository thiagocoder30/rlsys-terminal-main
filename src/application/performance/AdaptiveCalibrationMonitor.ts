import { ConfidenceTrendDirection, ConsensusTrendDirection } from './PerformanceSnapshot';

export class AdaptiveCalibrationMonitor {
    private readonly confidenceHistory: number[] = [];
    private readonly consensusHistory: number[] = [];
    private readonly MAX_SAMPLES = 20;

    public recordObservation(confidence: number, consensus: number): void {
        this.confidenceHistory.push(confidence);
        if (this.confidenceHistory.length > this.MAX_SAMPLES) {
            this.confidenceHistory.shift();
        }

        this.consensusHistory.push(consensus);
        if (this.consensusHistory.length > this.MAX_SAMPLES) {
            this.consensusHistory.shift();
        }
    }

    public getConfidenceTrend(): ConfidenceTrendDirection {
        if (this.confidenceHistory.length < 3) return 'STABLE';

        const half = Math.floor(this.confidenceHistory.length / 2);
        const firstHalf = this.confidenceHistory.slice(0, half);
        const secondHalf = this.confidenceHistory.slice(half);

        const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
        const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

        const diff = avgSecond - avgFirst;
        if (diff > 0.03) return 'UPWARD';
        if (diff < -0.03) return 'DOWNWARD';
        return 'STABLE';
    }

    public getConsensusTrend(): ConsensusTrendDirection {
        if (this.consensusHistory.length < 3) return 'STABLE';

        const half = Math.floor(this.consensusHistory.length / 2);
        const firstHalf = this.consensusHistory.slice(0, half);
        const secondHalf = this.consensusHistory.slice(half);

        const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
        const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

        const diff = avgSecond - avgFirst;
        if (diff > 0.05) return 'EXPANDING';
        if (diff < -0.05) return 'CONTRACTING';
        return 'STABLE';
    }

    public getConfidenceStabilityIndex(): number {
        if (this.confidenceHistory.length < 2) return 1.0;
        const mean = this.confidenceHistory.reduce((a, b) => a + b, 0) / this.confidenceHistory.length;
        const variance = this.confidenceHistory.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / this.confidenceHistory.length;
        const stdDev = Math.sqrt(variance);
        return Math.max(0, 1.0 - stdDev * 2);
    }
}
