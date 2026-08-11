import { ConfidenceTrend } from './ConfidenceTrend';

export interface ConfidenceMetrics {
    averageConfidence: number;
    trend: ConfidenceTrend;
    volatility: number;
    recoveryCount: number;
    stability: number;
}
