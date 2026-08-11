import { describe, it, expect, vi } from 'vitest';
import { DecisionIntelligenceEngine } from '../../../../src/domain/intelligence/decision/DecisionIntelligenceEngine';
import { DecisionContext } from '../../../../src/domain/intelligence/DecisionContext';
import { QuantitativeInput } from '../../../../src/domain/intelligence/common/QuantitativeInput';

describe('DecisionIntelligenceEngine', () => {
  const mockProbabilityEngine = {
    calculateProbabilities: vi.fn().mockReturnValue({ highestProbability: 0.8 })
  };
  const mockEntropyEngine = {
    calculateEntropy: vi.fn().mockReturnValue(2.1)
  };
  const mockVixEngine = {
    calculateVix: vi.fn().mockReturnValue(30)
  };
  const mockZScoreEngine = {
    calculateZScore: vi.fn().mockReturnValue(0.5)
  };
  const mockStrategyRankingEngine = {
    rankStrategies: vi.fn().mockReturnValue({
      bestCandidate: { id: 'stratA' },
      orderedStrategies: [{ finalScore: 90 }]
    })
  };

  const engine = new DecisionIntelligenceEngine(
    mockProbabilityEngine as unknown as IProbabilityEngine,
    mockEntropyEngine as unknown as IEntropyEngine,
    mockVixEngine as unknown as IVixEngine,
    mockZScoreEngine as unknown as IZScoreEngine,
    mockStrategyRankingEngine as unknown as IStrategyRankingEngine
  );

  const context: DecisionContext = {
    sessionId: 'sess1',
    timestamp: new Date().toISOString(),
    recentHistory: [1, 2, 3],
    activeStrategies: ['stratA']
  };

  it('should execute all underlying engines and aggregate results', () => {
    const summary = engine.analyze(context);

    expect(mockProbabilityEngine.calculateProbabilities).toHaveBeenCalledWith(context);
    expect(mockEntropyEngine.calculateEntropy).toHaveBeenCalledWith(context);
    expect(mockVixEngine.calculateVix).toHaveBeenCalledWith(context);
    expect(mockZScoreEngine.calculateZScore).toHaveBeenCalledWith(context);
    expect(mockStrategyRankingEngine.rankStrategies).toHaveBeenCalledWith(context);

    expect(summary.probabilitySummary.status).toBe('SUCCESS');
    expect(summary.entropySummary.status).toBe('SUCCESS');
    expect(summary.vixSummary.status).toBe('SUCCESS');
    expect(summary.zScoreSummary.status).toBe('SUCCESS');
    expect(summary.rankingSummary.status).toBe('SUCCESS');
    expect(summary.processingMetadata.status).toBe('SUCCESS');
    expect(summary.globalConfidence).toBe(1);
    expect(summary.diagnostics.entropy).toBe(2.1);
  });

  it('should not interrupt other engines if one fails (isolated failure)', () => {
    const failEntropyEngine = {
      calculateEntropy: vi.fn().mockImplementation(() => { throw new Error('Entropy failed'); })
    };
    
    const partialEngine = new DecisionIntelligenceEngine(
      mockProbabilityEngine as unknown as IProbabilityEngine,
      failEntropyEngine as unknown as IEntropyEngine,
      mockVixEngine as unknown as IVixEngine,
      mockZScoreEngine as unknown as IZScoreEngine,
      mockStrategyRankingEngine as unknown as IStrategyRankingEngine
    );

    const summary = partialEngine.analyze(context);

    expect(summary.probabilitySummary.status).toBe('SUCCESS');
    expect(summary.entropySummary.status).toBe('FAILED');
    expect(summary.entropySummary.messages[0]).toBe('Entropy failed');
    expect(summary.vixSummary.status).toBe('SUCCESS');
    expect(summary.zScoreSummary.status).toBe('SUCCESS');
    expect(summary.rankingSummary.status).toBe('SUCCESS');
    
    // 4 out of 5 succeeded
    expect(summary.processingMetadata.status).toBe('PARTIAL');
    expect(summary.globalConfidence).toBe(0.8);
  });

  it('should be compatible with QuantitativeEnginePipeline (implements execute)', () => {
    const input: QuantitativeInput = {
      sessionId: 'sess1',
      timestamp: new Date().toISOString(),
      recentSpins: [1, 2, 3],
      analyzedWindow: 3,
      executionParameters: { activeStrategies: ['stratA'] }
    };
    
    const output = engine.execute(input);
    expect(output.engineName).toBe('DecisionIntelligenceEngine');
    expect(output.metadata.status).toBe('SUCCESS');
    expect(output.score).toBe(100);
    expect(output.confidence).toBe(1);
  });

  it('should ensure numerical stability (no NaN/Infinity)', () => {
    const nanVixEngine = {
      calculateVix: vi.fn().mockReturnValue(NaN)
    };
    const infZScoreEngine = {
      calculateZScore: vi.fn().mockReturnValue(Infinity)
    };
    
    const unstableEngine = new DecisionIntelligenceEngine(
      mockProbabilityEngine as unknown as IProbabilityEngine,
      mockEntropyEngine as unknown as IEntropyEngine,
      nanVixEngine as unknown as IVixEngine,
      infZScoreEngine as unknown as IZScoreEngine,
      mockStrategyRankingEngine as unknown as IStrategyRankingEngine
    );

    const summary = unstableEngine.analyze(context);
    expect(Number.isNaN(summary.globalConfidence)).toBe(false);
    expect(Number.isFinite(summary.globalConfidence)).toBe(true);
  });
});
