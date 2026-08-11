import { describe, it, expect } from 'vitest';
import { PortfolioDiversificationCalculator } from '../../../src/application/portfolio/PortfolioDiversificationCalculator';
import { StrategyContribution } from '../../../src/application/portfolio/PortfolioSnapshot';

describe('PortfolioDiversificationCalculator', () => {
    it('should calculate diversification correctly (diversificação, equilíbrio)', () => {
        const calc = new PortfolioDiversificationCalculator();
        const contributions: StrategyContribution[] = [
            { strategyId: 'S1', contributionScore: 0.5 },
            { strategyId: 'S2', contributionScore: 0.5 }
        ];
        const div = calc.calculateDiversification(contributions);
        expect(div).toBe(0.5); // 1 - (0.5^2 + 0.5^2) = 1 - 0.5 = 0.5
    });

    it('should calculate concentration correctly (concentração)', () => {
        const calc = new PortfolioDiversificationCalculator();
        const contributions: StrategyContribution[] = [
            { strategyId: 'S1', contributionScore: 0.8 },
            { strategyId: 'S2', contributionScore: 0.2 }
        ];
        const conc = calc.calculateConcentration(contributions);
        expect(conc).toBe(0.8);
    });
});
