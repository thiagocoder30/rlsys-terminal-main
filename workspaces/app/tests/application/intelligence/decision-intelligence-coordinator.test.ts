import { describe, it, expect, vi } from 'vitest';
import { DecisionIntelligenceCoordinator } from '../../../src/application/intelligence/DecisionIntelligenceCoordinator';
import { DecisionContext } from '../../../src/domain/intelligence/DecisionContext';

describe('DecisionIntelligenceCoordinator', () => {
  it('should orchestrate decision engines via dependency injection and aggregate results', () => {
    const mockProbabilityEngine = {
      calculateProbabilities: vi.fn().mockReturnValue({ markovState: 'stable' })
    };
    const mockEntropyEngine = {
      calculateEntropy: vi.fn().mockReturnValue(0.85)
    };
    const mockZScoreEngine = {
      calculateZScore: vi.fn().mockReturnValue(1.2)
    };
    const mockVixEngine = {
      calculateVix: vi.fn().mockReturnValue(15.5)
    };
    const mockStrategyRankingEngine = {
      rankStrategies: vi.fn().mockReturnValue({ orderedStrategies: [{ candidateId: 'stratA', finalScore: 90 }] })
    };

    const coordinator = new DecisionIntelligenceCoordinator(
      mockProbabilityEngine,
      mockEntropyEngine,
      mockZScoreEngine,
      mockVixEngine,
      mockStrategyRankingEngine
    );

    const context: DecisionContext = {
      sessionId: 'session-123',
      timestamp: new Date().toISOString(),
      recentHistory: [10, 23, 5],
      activeStrategies: ['stratA']
    };

    const result = coordinator.analyze(context);

    // Verify propagation
    expect(mockProbabilityEngine.calculateProbabilities).toHaveBeenCalledWith(context);
    expect(mockEntropyEngine.calculateEntropy).toHaveBeenCalledWith(context);
    expect(mockZScoreEngine.calculateZScore).toHaveBeenCalledWith(context);
    expect(mockVixEngine.calculateVix).toHaveBeenCalledWith(context);
    expect(mockStrategyRankingEngine.rankStrategies).toHaveBeenCalledWith(context);

    // Verify aggregation
    expect(result.metrics.probabilityData).toEqual({ markovState: 'stable' });
    expect(result.metrics.entropyValue).toBe(0.85);
    expect(result.metrics.zScoreValue).toBe(1.2);
    expect(result.metrics.vixValue).toBe(15.5);
    expect(result.metrics.strategyRankings).toEqual({ orderedStrategies: [{ candidateId: 'stratA', finalScore: 90 }] });

    // Verify recommendation structure
    expect(result.recommendation.action).toBe('OBSERVE');
  });
});
