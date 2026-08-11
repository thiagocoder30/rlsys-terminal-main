import { describe, it, expect } from 'vitest';
import { PortfolioCorrelationEngine } from '../../../src/application/portfolio/PortfolioCorrelationEngine';
import { StrategyContribution } from '../../../src/application/portfolio/PortfolioSnapshot';

describe('PortfolioCorrelationEngine', () => {
    it('should calculate overall correlation (correlação positiva, negativa, estratégias independentes)', () => {
        const engine = new PortfolioCorrelationEngine();
        
        const contributions: StrategyContribution[] = [
            { strategyId: 'S1', contributionScore: 0.5 },
            { strategyId: 'S2', contributionScore: 0.5 }
        ];

        const overall = engine.calculateOverallCorrelation(contributions);
        expect(overall).toBe(0.8); // 1.0 - (2 * 0.1) = 0.8
    });

    it('should build correlation matrix', () => {
        const engine = new PortfolioCorrelationEngine();
        
        const contributions: StrategyContribution[] = [
            { strategyId: 'S1', contributionScore: 0.5 },
            { strategyId: 'S2', contributionScore: 0.5 }
        ];

        const matrix = engine.buildCorrelationMatrix(contributions);
        expect(matrix['S1']).toBe(1.0);
        expect(matrix['S2']).toBe(1.0);
    });
});
