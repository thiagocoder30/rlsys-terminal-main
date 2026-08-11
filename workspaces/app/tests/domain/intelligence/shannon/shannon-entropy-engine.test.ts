import { describe, it, expect } from 'vitest';
import { ShannonEntropyEngine } from '../../../../src/domain/intelligence/shannon/ShannonEntropyEngine';
import { QuantitativeInput } from '../../../../src/domain/intelligence/common/QuantitativeInput';
import { DecisionContext } from '../../../../src/domain/intelligence/DecisionContext';

describe('ShannonEntropyEngine', () => {
  const engine = new ShannonEntropyEngine();

  it('should process a valid sequence and return a successful QuantitativeOutput', () => {
    const input: QuantitativeInput = {
      sessionId: 'sess1',
      timestamp: new Date().toISOString(),
      recentSpins: [0, 32, 15, 19, 4, 21, 2], // 7 unique spins
      analyzedWindow: 7,
      executionParameters: {}
    };

    const output = engine.execute(input);

    expect(output.engineName).toBe('ShannonEntropyEngine');
    expect(output.metadata.status).toBe('SUCCESS');
    expect(output.score).toBeGreaterThan(0);
    expect(output.confidence).toBe(7 / 37); // sampleSize / 37
    expect(output.diagnostics.entropy).toBeGreaterThan(0);
    expect(output.diagnostics.sampleSize).toBe(7);
    expect(output.diagnostics.observedStates.length).toBe(7);
  });

  it('should return FAILED for an empty sequence', () => {
    const input: QuantitativeInput = {
      sessionId: 'sess2',
      timestamp: new Date().toISOString(),
      recentSpins: [],
      analyzedWindow: 0,
      executionParameters: {}
    };

    const output = engine.execute(input);

    expect(output.metadata.status).toBe('FAILED');
    expect(output.metadata.messages[0]).toMatch(/INSUFFICIENT_DATA/);
    expect(output.score).toBe(0);
  });

  it('should return FAILED if all elements in sequence are invalid', () => {
    const input: QuantitativeInput = {
      sessionId: 'sess3',
      timestamp: new Date().toISOString(),
      recentSpins: [38, -1, 50] as number[],
      analyzedWindow: 3,
      executionParameters: {}
    };

    const output = engine.execute(input);

    expect(output.metadata.status).toBe('FAILED');
    expect(output.metadata.messages[0]).toMatch(/INSUFFICIENT_DATA/);
    expect(output.score).toBe(0);
  });

  it('should implement IEntropyEngine contract successfully', () => {
    const context: DecisionContext = {
      sessionId: 'sess4',
      timestamp: new Date().toISOString(),
      recentHistory: [5, 5, 5, 5], // deterministic, entropy should be 0
      activeStrategies: []
    };

    const entropy = engine.calculateEntropy(context);
    expect(entropy).toBe(0);
  });

  it('should return valid entropy from contract with uniformly distributed sequence', () => {
    const context: DecisionContext = {
      sessionId: 'sess5',
      timestamp: new Date().toISOString(),
      recentHistory: [1, 2, 3, 4], 
      activeStrategies: []
    };

    const entropy = engine.calculateEntropy(context);
    expect(entropy).toBe(2);
  });
});
