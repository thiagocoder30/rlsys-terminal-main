import { describe, it, expect, vi } from 'vitest';
import { OperationalVixEngine } from '../../../../src/domain/intelligence/vix/OperationalVixEngine';
import { QuantitativeInput } from '../../../../src/domain/intelligence/common/QuantitativeInput';
import { DecisionContext } from '../../../../src/domain/intelligence/DecisionContext';
import { IProbabilityEngine } from '../../../../src/domain/contracts/IProbabilityEngine';
import { IEntropyEngine } from '../../../../src/domain/contracts/IEntropyEngine';

describe('OperationalVixEngine', () => {
  const mockMarkovEngine: IProbabilityEngine = {
    calculateProbabilities: vi.fn().mockReturnValue({
      mostProbableNextStates: [{ state: 10, probability: 0.5 }, { state: 20, probability: 0.2 }]
    })
  };

  const mockShannonEngine: IEntropyEngine = {
    calculateEntropy: vi.fn().mockReturnValue(2.5) // ~50% of max entropy 5.2
  };

  const engine = new OperationalVixEngine(mockMarkovEngine, mockShannonEngine);

  it('should process a valid sequence and return a successful QuantitativeOutput', () => {
    const input: QuantitativeInput = {
      sessionId: 'sess1',
      timestamp: new Date().toISOString(),
      recentSpins: [0, 32, 15, 19, 4, 21, 2], // 7 spins
      analyzedWindow: 7,
      executionParameters: {}
    };

    const output = engine.execute(input);

    expect(output.engineName).toBe('OperationalVixEngine');
    expect(output.metadata.status).toBe('SUCCESS');
    expect(output.score).toBeGreaterThan(0);
    expect(output.diagnostics.vixScore).toBeDefined();
    expect(output.diagnostics.marketRegime).toBeDefined();
    expect(output.diagnostics.riskLevel).toBeDefined();
    
    // Ensure engines were called
    expect(mockMarkovEngine.calculateProbabilities).toHaveBeenCalled();
    expect(mockShannonEngine.calculateEntropy).toHaveBeenCalled();
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

  it('should fallback securely when internal engines fail', () => {
    const failingMarkovEngine: IProbabilityEngine = {
      calculateProbabilities: vi.fn().mockReturnValue({ error: 'Markov error' })
    };
    const failingShannonEngine: IEntropyEngine = {
      calculateEntropy: vi.fn().mockReturnValue(0)
    };

    const robustEngine = new OperationalVixEngine(failingMarkovEngine, failingShannonEngine);
    const input: QuantitativeInput = {
      sessionId: 'sess3',
      timestamp: new Date().toISOString(),
      recentSpins: [0, 1, 2, 3],
      analyzedWindow: 4,
      executionParameters: {}
    };

    const output = robustEngine.execute(input);

    expect(output.metadata.status).toBe('SUCCESS'); // the engine survives
    expect(output.metadata.messages[0]).toMatch(/Markov Error/);
    expect(output.diagnostics.vixScore).toBeDefined();
  });

  it('should implement IVixEngine contract successfully', () => {
    const context: DecisionContext = {
      sessionId: 'sess4',
      timestamp: new Date().toISOString(),
      recentHistory: [5, 5, 5, 5],
      activeStrategies: []
    };

    const vix = engine.calculateVix(context);
    expect(vix).toBeGreaterThanOrEqual(0);
    expect(vix).toBeLessThanOrEqual(100);
  });
});
