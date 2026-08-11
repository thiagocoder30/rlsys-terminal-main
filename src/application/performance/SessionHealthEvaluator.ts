import { SessionHealthStatus } from './PerformanceSnapshot';

export interface HealthEvaluationInput {
    drawdownPercent: number;
    blockRatio: number;
    averageConfidence: number;
    averageConsensus: number;
    averageVix: number;
    accuracyPercent: number;
}

export class SessionHealthEvaluator {
    public evaluate(input: HealthEvaluationInput): SessionHealthStatus {
        if (input.drawdownPercent >= 15 || input.blockRatio >= 0.5 || input.averageVix >= 80) {
            return 'CRITICAL';
        }

        if (input.drawdownPercent >= 10 || input.blockRatio >= 0.3 || input.averageVix >= 60 || input.accuracyPercent < 40) {
            return 'DEGRADED';
        }

        if (input.drawdownPercent >= 5 || input.averageConfidence < 0.5 || input.averageConsensus < 0.4) {
            return 'STABLE';
        }

        if (input.drawdownPercent <= 2 && input.averageConfidence >= 0.7 && input.averageConsensus >= 0.6 && input.averageVix <= 35) {
            return 'EXCELLENT';
        }

        return 'GOOD';
    }
}
