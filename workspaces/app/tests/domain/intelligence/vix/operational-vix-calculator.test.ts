import { describe, it, expect } from 'vitest';
import { OperationalVixCalculator } from '../../../../src/domain/intelligence/vix/OperationalVixCalculator';

describe('OperationalVixCalculator', () => {
  const calculator = new OperationalVixCalculator();

  it('should correctly classify LOW market regime', () => {
    // Low entropy, highly concentrated markov (max prob = 1), good sample size
    const result = calculator.calculate(0.1, 1.0, [1.0, 0, 0], 50);
    expect(result.vixScore).toBeLessThan(30);
    expect(result.marketRegime).toBe('LOW');
    expect(result.riskLevel).toBe('LOW_RISK');
  });

  it('should correctly classify NORMAL market regime', () => {
    // Medium entropy (0.5), decent confidence, moderate markov dispersion
    const result = calculator.calculate(0.5, 0.8, [0.3, 0.2, 0.1], 37);
    expect(result.vixScore).toBeGreaterThanOrEqual(30);
    expect(result.vixScore).toBeLessThan(60);
    expect(result.marketRegime).toBe('NORMAL');
    expect(result.riskLevel).toBe('MODERATE_RISK');
  });

  it('should correctly classify HIGH market regime', () => {
    // High entropy (0.8), low confidence, high markov dispersion
    const result = calculator.calculate(0.8, 0.5, [0.1, 0.05, 0.05], 20);
    expect(result.vixScore).toBeGreaterThanOrEqual(60);
    expect(result.vixScore).toBeLessThan(85);
    expect(result.marketRegime).toBe('HIGH');
    expect(result.riskLevel).toBe('HIGH_RISK');
  });

  it('should correctly classify EXTREME market regime', () => {
    // Very high entropy (1.0), zero confidence (sample size < 10), max markov dispersion
    const result = calculator.calculate(1.0, 0.1, [0.05, 0.05], 5);
    expect(result.vixScore).toBeGreaterThanOrEqual(85);
    expect(result.marketRegime).toBe('EXTREME');
    expect(result.riskLevel).toBe('CRITICAL_RISK');
  });

  it('should handle edge cases and invalid numbers safely', () => {
    const result = calculator.calculate(NaN, Infinity, [], 0);
    expect(result.vixScore).toBe(50);
    expect(result.marketRegime).toBe('NORMAL');
  });
});
