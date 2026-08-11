import { ScenarioProbabilityCalculator } from './ScenarioProbabilityCalculator';

export interface GeneratedScenario {
    scenarioId: string;
    description: string;
    probability: number;
    confidence: number;
    expectedOutcome: string;
    timestamp: string;
}

export class ScenarioGenerator {
    constructor(private readonly calculator: ScenarioProbabilityCalculator) {}

    public generateScenarios(
        regime: string,
        performanceScore: number,
        learningIndex: number,
        evolutionIndex: number
    ): GeneratedScenario[] {
        const timestamp = new Date().toISOString();
        
        // Base scenarios based on institutional state
        const rawScores: Record<string, number> = {
            'TREND_CONTINUATION': (regime === 'TRENDING' ? 0.8 : 0.2) * performanceScore,
            'MEAN_REVERSION': (regime === 'RANGING' ? 0.8 : 0.2) * (1 - performanceScore),
            'VOLATILITY_EXPANSION': (regime === 'VOLATILE' ? 0.7 : 0.3) * (learningIndex * 0.5),
            'STABLE_ACCUMULATION': (regime === 'STABLE' ? 0.9 : 0.1) * evolutionIndex
        };

        const probabilities = this.calculator.calculateProbabilities(rawScores);
        const scenarios: GeneratedScenario[] = [];

        let i = 0;
        for (const [key, probability] of Object.entries(probabilities)) {
            scenarios.push({
                scenarioId: `SCENARIO-${i++}`,
                description: `Scenario for ${key}`,
                probability,
                confidence: probability * evolutionIndex,
                expectedOutcome: key,
                timestamp
            });
        }

        return scenarios.sort((a, b) => b.probability - a.probability);
    }
}
