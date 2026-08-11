import { describe, it, expect, vi } from 'vitest';
import { StrategyRankingEngine } from '../../../../src/domain/intelligence/strategy/StrategyRankingEngine';
import { StrategyCandidate } from '../../../../src/domain/intelligence/strategy/StrategyCandidate';
import { QuantitativeInput } from '../../../../src/domain/intelligence/common/QuantitativeInput';
import { DecisionContext } from '../../../../src/domain/intelligence/DecisionContext';
import { QuantitativeEngineRegistry } from '../../../../src/application/intelligence/QuantitativeEngineRegistry';
import { QuantitativeEnginePipeline } from '../../../../src/application/intelligence/QuantitativeEnginePipeline';
import { DecisionIntelligenceCoordinator } from '../../../../src/application/intelligence/DecisionIntelligenceCoordinator';
import { RiskGovernanceService } from '../../../../src/application/governance/RiskGovernanceService';
import { SystemGovernancePolicy } from '../../../../src/domain/governance/SystemGovernancePolicy';

describe('StrategyRankingEngine', () => {
  const mockProbabilityEngine = {
    calculateProbabilities: vi.fn().mockReturnValue({
      mostProbableNextStates: [{ state: 10, probability: 0.8 }]
    })
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

  const candidates: StrategyCandidate[] = [
    { id: 'stratA', name: 'Strategy A', baseWinRate: 0.45, riskMultiplier: 1.0 },
    { id: 'stratB', name: 'Strategy B', baseWinRate: 0.50, riskMultiplier: 1.5 },
    { id: 'stratC', name: 'Strategy C', baseWinRate: 0.48, riskMultiplier: 1.2 }
  ];

  const engine = new StrategyRankingEngine(
    mockProbabilityEngine as unknown as IProbabilityEngine,
    mockEntropyEngine as unknown as IEntropyEngine,
    mockVixEngine as unknown as IVixEngine,
    mockZScoreEngine as unknown as IZScoreEngine,
    candidates
  );

  it('should rank strategies correctly and apply contributions', () => {
    const context: DecisionContext = {
      sessionId: 'sess1',
      timestamp: new Date().toISOString(),
      recentHistory: new Array(30).fill(10), // decent sample size for confidence
      activeStrategies: ['stratA', 'stratB', 'stratC']
    };

    const ranking = engine.rankStrategies(context);
    
    // Check output structure
    expect(ranking.orderedStrategies).toBeDefined();
    expect(ranking.orderedStrategies.length).toBe(3);
    
    // All candidates must be ranked (no discards)
    const rankedIds = ranking.orderedStrategies.map(s => s.candidateId);
    expect(rankedIds).toContain('stratA');
    expect(rankedIds).toContain('stratB');
    expect(rankedIds).toContain('stratC');

    // Check order (by finalScore descending)
    const first = ranking.orderedStrategies[0];
    const second = ranking.orderedStrategies[1];
    expect(first.finalScore).toBeGreaterThanOrEqual(second.finalScore);
    
    expect(ranking.bestCandidate?.id).toBe(first.candidateId);
  });

  it('should handle ties in ranking gracefully', () => {
    const tieCandidates: StrategyCandidate[] = [
      { id: 'strat1', name: 'Strategy 1', baseWinRate: 0.5, riskMultiplier: 1.0 },
      { id: 'strat2', name: 'Strategy 2', baseWinRate: 0.5, riskMultiplier: 1.0 }
    ];
    
    const tieEngine = new StrategyRankingEngine(
      mockProbabilityEngine as unknown as IProbabilityEngine,
      mockEntropyEngine as unknown as IEntropyEngine,
      mockVixEngine as unknown as IVixEngine,
      mockZScoreEngine as unknown as IZScoreEngine,
      tieCandidates
    );

    const context: DecisionContext = {
      sessionId: 'sess2',
      timestamp: new Date().toISOString(),
      recentHistory: [1, 2, 3],
      activeStrategies: ['strat1', 'strat2']
    };

    const ranking = tieEngine.rankStrategies(context);
    expect(ranking.orderedStrategies[0].finalScore).toBe(ranking.orderedStrategies[1].finalScore);
  });

  it('should ensure numerical stability (no NaN/Infinity)', () => {
    // Inject failures in underlying engines
    const failProb = { calculateProbabilities: () => ({ error: true }) };
    const failEnt = { calculateEntropy: () => { throw new Error('fail'); } };
    const failVix = { calculateVix: () => NaN };
    const failZ = { calculateZScore: () => Infinity };

    const stableEngine = new StrategyRankingEngine(
      failProb as unknown as IProbabilityEngine, failEnt as unknown as IEntropyEngine, failVix as unknown as IVixEngine, failZ as unknown as IZScoreEngine, candidates
    );
    
    const context: DecisionContext = {
      sessionId: 'sess3',
      timestamp: new Date().toISOString(),
      recentHistory: [],
      activeStrategies: ['stratA']
    };

    const ranking = stableEngine.rankStrategies(context);
    const score = ranking.orderedStrategies[0];
    
    expect(Number.isNaN(score.finalScore)).toBe(false);
    expect(Number.isFinite(score.finalScore)).toBe(true);
  });

  it('should handle empty strategies safely', () => {
    const context: DecisionContext = {
      sessionId: 'sess4',
      timestamp: new Date().toISOString(),
      recentHistory: [1, 2],
      activeStrategies: []
    };
    const ranking = engine.rankStrategies(context);
    expect(ranking.orderedStrategies.length).toBe(0);
    expect(ranking.bestCandidate).toBeNull();
  });

  it('should handle a single strategy', () => {
    const context: DecisionContext = {
      sessionId: 'sess5',
      timestamp: new Date().toISOString(),
      recentHistory: [1, 2],
      activeStrategies: ['stratA']
    };
    const ranking = engine.rankStrategies(context);
    expect(ranking.orderedStrategies.length).toBe(1);
    expect(ranking.bestCandidate?.id).toBe('stratA');
  });

  it('should be compatible with QuantitativeEnginePipeline', () => {
    const registry = new QuantitativeEngineRegistry();
    registry.register(engine);
    const pipeline = new QuantitativeEnginePipeline(registry);
    
    const input: QuantitativeInput = {
      sessionId: 'sess6',
      timestamp: new Date().toISOString(),
      recentSpins: [0, 32, 15, 19, 4, 21, 2],
      analyzedWindow: 7,
      executionParameters: {}
    };

    const outputs = pipeline.executeAll(input);
    expect(outputs).toHaveLength(1);
    expect(outputs[0].engineName).toBe('StrategyRankingEngine');
    expect(outputs[0].metadata.status).toBe('SUCCESS');
  });

  it('should be compatible with DecisionIntelligenceCoordinator', () => {
    const policy = new SystemGovernancePolicy();
    const riskService = new RiskGovernanceService(policy);
    
    const coordinator = new DecisionIntelligenceCoordinator(
      mockProbabilityEngine as unknown as IProbabilityEngine,
      mockEntropyEngine as unknown as IEntropyEngine,
      mockZScoreEngine as unknown as IZScoreEngine,
      mockVixEngine as unknown as IVixEngine,
      engine
    );
    
    const context: DecisionContext = {
      sessionId: 'sess7',
      timestamp: new Date().toISOString(),
      recentHistory: [5, 24, 16, 33, 1, 20],
      activeStrategies: ['stratA']
    };
    
    const result = coordinator.analyze(context);
    expect(result.metrics.strategyRankings).toBeDefined();
    // Verify it is of type StrategyRanking (has orderedStrategies)
    expect((result.metrics.strategyRankings as Record<string, unknown>).orderedStrategies).toBeDefined();
  });
});
