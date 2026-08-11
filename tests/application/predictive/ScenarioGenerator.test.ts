import { describe, it, expect } from 'vitest';
import { ScenarioGenerator } from '../../../src/application/predictive/ScenarioGenerator';
import { ScenarioProbabilityCalculator } from '../../../src/application/predictive/ScenarioProbabilityCalculator';

describe('ScenarioGenerator', () => {
    it('should generate scenarios properly', () => {
        const calculator = new ScenarioProbabilityCalculator();
        const generator = new ScenarioGenerator(calculator);
        
        const scenarios = generator.generateScenarios('TRENDING', 0.8, 0.7, 0.9);
        expect(scenarios.length).toBeGreaterThan(0);
        expect(scenarios[0].probability).toBeGreaterThan(0);
        expect(scenarios[0].expectedOutcome).toBe('TREND_CONTINUATION');
    });
});
