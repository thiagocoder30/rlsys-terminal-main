import { ConfidenceScore } from './ConfidenceScore';
import { ConfidenceTrend } from './ConfidenceTrend';

export interface StrategyConfidence {
    strategyId: string;
    score: ConfidenceScore;
    trend: ConfidenceTrend;
    volatility: number;
    stability: number;
    recovery: number;
    lastUpdated: number;
}
