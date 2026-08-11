import { StrategyConfidence } from '../../domain/adaptive/StrategyConfidence';

export class ConfidenceCalibrationService {
    public calibrateWeight(confidence: StrategyConfidence): number {
        let weight = confidence.score.value / 100;
        
        if (confidence.trend === 'UP') weight *= 1.1;
        if (confidence.trend === 'DOWN') weight *= 0.9;
        
        if (confidence.volatility > 50) weight *= 0.8;
        
        return Math.min(Math.max(weight, 0.1), 2.0);
    }

    public calibratePriority(confidence: StrategyConfidence): number {
        const score = confidence.score.value;
        if (score >= 90) return 1;
        if (score >= 70) return 2;
        if (score >= 50) return 3;
        if (score >= 30) return 4;
        return 5;
    }
}
