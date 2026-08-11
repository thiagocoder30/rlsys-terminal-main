import { describe, it, expect } from 'vitest';
import { PortfolioHealthCalculator } from '../../../src/application/portfolio/PortfolioHealthCalculator';

describe('PortfolioHealthCalculator', () => {
    it('should calculate valid health score (índice de saúde, confiança, estabilidade)', () => {
        const calc = new PortfolioHealthCalculator();
        const health = calc.calculateHealth(0.8, 0.2, 0.9, 0.3);
        expect(health).toBeGreaterThan(0.5);
    });

    it('should apply penalty when concentration is high', () => {
        const calc = new PortfolioHealthCalculator();
        const healthHighConc = calc.calculateHealth(0.8, 0.9, 0.9, 0.3);
        const healthLowConc = calc.calculateHealth(0.8, 0.2, 0.9, 0.3);
        expect(healthHighConc).toBeLessThan(healthLowConc);
    });
});
