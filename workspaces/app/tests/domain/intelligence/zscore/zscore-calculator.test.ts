import { describe, it, expect } from 'vitest';
import { ZScoreCalculator } from '../../../../src/domain/intelligence/zscore/ZScoreCalculator';

describe('ZScoreCalculator', () => {
  const calculator = new ZScoreCalculator();

  it('should correctly calculate mean, variance, std dev for a sequence', () => {
    // Sequence: 10, 12, 23, 23, 16, 23, 21, 16
    const seq = [10, 12, 23, 23, 16, 23, 21, 16];
    const result = calculator.calculate(seq);
    
    expect(result.mean).toBe(18); // sum(144) / 8 = 18
    // sq diffs: (10-18)^2=64, (12-18)^2=36, (23-18)^2=25, 25, (16-18)^2=4, 25, (21-18)^2=9, 4
    // sum sq diffs = 64+36+25+25+4+25+9+4 = 192
    // variance = 192 / (8-1) = 192 / 7 = 27.42857
    expect(result.variance).toBeCloseTo(192 / 7);
    expect(result.standardDeviation).toBeCloseTo(Math.sqrt(192 / 7));
  });

  it('should calculate a positive z-score when sample mean > expected mean', () => {
    // Mean of 30 > 18
    const result = calculator.calculate([30, 31, 29, 30]);
    expect(result.mean).toBe(30);
    expect(result.zScore).toBeGreaterThan(0);
  });

  it('should calculate a negative z-score when sample mean < expected mean', () => {
    // Mean of 5 < 18
    const result = calculator.calculate([5, 6, 4, 5]);
    expect(result.mean).toBe(5);
    expect(result.zScore).toBeLessThan(0);
  });

  it('should calculate z-score close to zero when sample mean is around expected mean', () => {
    const result = calculator.calculate([18, 17, 19, 18]);
    expect(result.mean).toBe(18);
    expect(result.zScore).toBe(0);
  });

  it('should throw INSUFFICIENT_DATA for empty sequence', () => {
    expect(() => calculator.calculate([])).toThrow(/INSUFFICIENT_DATA/);
  });

  it('should handle uniform sequence without division by zero errors', () => {
    const result = calculator.calculate([18, 18, 18, 18]);
    expect(result.mean).toBe(18);
    expect(result.variance).toBe(0);
    expect(result.standardDeviation).toBe(0);
    expect(result.zScore).toBe(0);
  });

  it('should handle sequence of length 1 safely', () => {
    const result = calculator.calculate([18]);
    expect(result.mean).toBe(18);
    expect(result.variance).toBe(0);
    expect(result.standardDeviation).toBe(0);
    expect(result.zScore).toBe(0);
  });

  it('should ensure numerical stability (no NaN/Infinity)', () => {
    // Pass string, NaN, undefined - should be filtered out
    const seq = [NaN, Infinity, -Infinity, null, undefined, "20", 38, -5, 18] as unknown as number[];
    const result = calculator.calculate(seq);
    
    // Only '18' is valid
    expect(result.mean).toBe(18);
    expect(result.variance).toBe(0);
    expect(result.standardDeviation).toBe(0);
    expect(Number.isNaN(result.zScore)).toBe(false);
  });
});
