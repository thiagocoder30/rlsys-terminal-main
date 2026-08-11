import { describe, it, expect } from 'vitest';
import { ShannonEntropyCalculator } from '../../../../src/domain/intelligence/shannon/ShannonEntropyCalculator';

describe('ShannonEntropyCalculator', () => {
  const calculator = new ShannonEntropyCalculator();

  it('should return 0 entropy for an empty sequence', () => {
    expect(calculator.calculateEntropy([])).toBe(0);
    expect(calculator.calculateEntropy(null as unknown as number[])).toBe(0);
  });

  it('should ignore invalid values in the sequence', () => {
    const sequence = [1, 2, -1, 37, null, undefined, NaN, 1.5, 3] as number[];
    // Valid: 1, 2, 3
    const probs = calculator.calculateProbabilities(sequence);
    expect(probs.length).toBe(3); // probabilities for 1, 2, 3
    expect(probs[0]).toBeCloseTo(1 / 3);
  });

  it('should correctly calculate maximum entropy', () => {
    // log2(37) ≈ 5.209
    const max = calculator.calculateMaxEntropy();
    expect(max).toBeCloseTo(Math.log2(37));
  });

  it('should correctly calculate entropy of a deterministic sequence', () => {
    // Sequence with all same outcomes (entropy = 0)
    const sequence = [5, 5, 5, 5, 5];
    const entropy = calculator.calculateEntropy(sequence);
    expect(entropy).toBe(0);
  });

  it('should correctly calculate entropy of a uniform sequence', () => {
    // 4 distinct states appearing exactly once
    const sequence = [1, 2, 3, 4];
    const entropy = calculator.calculateEntropy(sequence);
    // Probabilities = [0.25, 0.25, 0.25, 0.25]
    // Entropy = -4 * (0.25 * log2(0.25)) = -4 * (0.25 * -2) = 2
    expect(entropy).toBe(2);
  });

  it('should correctly calculate state occupation percentage', () => {
    const sequence = [1, 2, 3, 4, 1];
    // 4 unique states out of 37
    const expected = (4 / 37) * 100;
    expect(calculator.calculateStateOccupationPercentage(sequence)).toBeCloseTo(expected);
  });

  it('should correctly output normalized entropy', () => {
    const sequence = [1, 2, 3, 4];
    const entropy = calculator.calculateEntropy(sequence);
    const max = calculator.calculateMaxEntropy();
    const normalized = calculator.calculateNormalizedEntropy(sequence);
    expect(normalized).toBeCloseTo(entropy / max);
  });

  it('should correctly identify observed states', () => {
    const sequence = [0, 36, 12, 12, 0];
    const states = calculator.getObservedStates(sequence);
    expect(states).toContain(0);
    expect(states).toContain(36);
    expect(states).toContain(12);
    expect(states.length).toBe(3);
  });
});
