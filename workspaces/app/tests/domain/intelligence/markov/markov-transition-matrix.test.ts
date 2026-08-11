import { describe, it, expect } from 'vitest';
import { MarkovTransitionMatrix } from '../../../../src/domain/intelligence/markov/MarkovTransitionMatrix';

describe('MarkovTransitionMatrix', () => {
  it('should initialize correctly', () => {
    const matrix = new MarkovTransitionMatrix();
    expect(matrix.getProbability(0, 1)).toBe(0);
  });

  it('should register valid transitions and calculate probabilities', () => {
    const matrix = new MarkovTransitionMatrix();
    matrix.registerTransition(0, 15);
    matrix.registerTransition(0, 32);
    matrix.registerTransition(0, 15);

    expect(matrix.getProbability(0, 15)).toBe(2 / 3);
    expect(matrix.getProbability(0, 32)).toBe(1 / 3);
    expect(matrix.getProbability(0, 0)).toBe(0);
  });

  it('should ignore invalid states during registration', () => {
    const matrix = new MarkovTransitionMatrix();
    matrix.registerTransition(10, 37);
    matrix.registerTransition(-1, 15);
    matrix.registerTransition(10, 15);

    expect(matrix.getProbability(10, 15)).toBe(1);
    expect(matrix.getProbability(10, 37)).toBe(0);
  });

  it('should build from a valid sequence', () => {
    const matrix = new MarkovTransitionMatrix();
    matrix.buildFromSequence([0, 32, 15, 19, 4, 21, 2, 25]);

    expect(matrix.getProbability(0, 32)).toBe(1);
    expect(matrix.getProbability(32, 15)).toBe(1);
    expect(matrix.getProbability(15, 19)).toBe(1);
  });

  it('should throw an error if the sequence is insufficient', () => {
    const matrix = new MarkovTransitionMatrix();
    
    expect(() => matrix.buildFromSequence([])).toThrow(/INSUFFICIENT_DATA/);
    expect(() => matrix.buildFromSequence([0])).toThrow(/INSUFFICIENT_DATA/);
    expect(() => matrix.buildFromSequence([0, 38])).toThrow(/INSUFFICIENT_DATA/);
  });

  it('should return the most probable next states', () => {
    const matrix = new MarkovTransitionMatrix();
    matrix.buildFromSequence([0, 1, 0, 1, 0, 2, 0, 3, 0, 1]);

    const probableStates = matrix.getMostProbableNextStates(0);
    expect(probableStates.length).toBe(3);
    expect(probableStates[0].state).toBe(1);
    expect(probableStates[0].probability).toBe(0.6);
    expect(probableStates[1].state).toBe(2);
    expect(probableStates[1].probability).toBe(0.2);
    expect(probableStates[2].state).toBe(3);
    expect(probableStates[2].probability).toBe(0.2);
  });
});
