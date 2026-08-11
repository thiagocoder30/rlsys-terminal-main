import { MarketRegimeType } from './RegimeSnapshot';

export interface RegimeClassificationInput {
    vix: number;
    entropy: number;
    confidence: number;
    consensus: number;
    sampleCount: number;
}

export class RegimeClassifier {
    public classify(input: RegimeClassificationInput): { regime: MarketRegimeType; confidenceScore: number } {
        if (input.sampleCount < 10) {
            return { regime: 'LOW_INFORMATION', confidenceScore: 0.95 };
        }

        if (input.vix >= 70 || input.entropy >= 0.98) {
            return { regime: 'CHAOTIC', confidenceScore: 0.88 };
        }

        if (input.confidence >= 0.75 && input.consensus >= 0.65 && input.entropy <= 0.88) {
            return { regime: 'TRENDING', confidenceScore: 0.82 };
        }

        if (input.vix <= 40 && input.entropy >= 0.92 && input.confidence >= 0.60) {
            return { regime: 'MEAN_REVERSION', confidenceScore: 0.78 };
        }

        return { regime: 'BALANCED', confidenceScore: 0.75 };
    }
}
