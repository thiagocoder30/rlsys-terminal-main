import { describe, it, expect } from 'vitest';
import { MarkovProbabilityEngine } from '../../../../src/domain/intelligence/markov/MarkovProbabilityEngine';
import { QuantitativeInput } from '../../../../src/domain/intelligence/common/QuantitativeInput';

describe('MarkovProbabilityEngine', () => {
  it('should return a successful QuantitativeOutput for a valid input', () => {
    const engine = new MarkovProbabilityEngine();
    const input: QuantitativeInput = {
      sessionId: 'test-session',
      timestamp: new Date().toISOString(),
      recentSpins: [0, 1, 0, 1, 0, 2],
      analyzedWindow: 6,
      executionParameters: {}
    };

    const output = engine.execute(input);

    expect(output.engineName).toBe('MarkovProbabilityEngine');
    expect(output.metadata.status).toBe('SUCCESS');
    expect(output.diagnostics.mostProbableNextStates).toBeDefined();
    expect(output.diagnostics.lastSpin).toBe(2);
  });

  it('should return a failed QuantitativeOutput for an insufficient input sequence', () => {
    const engine = new MarkovProbabilityEngine();
    const input: QuantitativeInput = {
      sessionId: 'test-session',
      timestamp: new Date().toISOString(),
      recentSpins: [0],
      analyzedWindow: 1,
      executionParameters: {}
    };

    const output = engine.execute(input);

    expect(output.engineName).toBe('MarkovProbabilityEngine');
    expect(output.metadata.status).toBe('FAILED');
    expect(output.score).toBe(0);
    expect(output.confidence).toBe(0);
    expect(output.metadata.messages[0]).toMatch(/INSUFFICIENT_DATA/);
  });
  
  it('should implement IProbabilityEngine calculateProbabilities', () => {
    const engine = new MarkovProbabilityEngine();
    const result = engine.calculateProbabilities({
      sessionId: 'sess1',
      timestamp: new Date().toISOString(),
      recentHistory: [0, 15, 0, 32],
      activeStrategies: []
    });
    
    expect(result.mostProbableNextStates).toBeDefined();
  });
});
