import { describe, it, expect } from 'vitest';
import { ZScoreEngine } from '../../../../src/domain/intelligence/zscore/ZScoreEngine';
import { QuantitativeInput } from '../../../../src/domain/intelligence/common/QuantitativeInput';
import { DecisionContext } from '../../../../src/domain/intelligence/DecisionContext';
import { QuantitativeEngineRegistry } from '../../../../src/application/intelligence/QuantitativeEngineRegistry';
import { QuantitativeEnginePipeline } from '../../../../src/application/intelligence/QuantitativeEnginePipeline';
import { DecisionIntelligenceCoordinator } from '../../../../src/application/intelligence/DecisionIntelligenceCoordinator';
import { RiskGovernanceService } from '../../../../src/application/governance/RiskGovernanceService';
import { SystemGovernancePolicy } from '../../../../src/domain/governance/SystemGovernancePolicy';

describe('ZScoreEngine', () => {
  const engine = new ZScoreEngine();

  it('should process a valid sequence and return a successful QuantitativeOutput', () => {
    const input: QuantitativeInput = {
      sessionId: 'sess1',
      timestamp: new Date().toISOString(),
      recentSpins: [10, 12, 23, 23, 16, 23, 21, 16], // mean 18
      analyzedWindow: 8,
      executionParameters: {}
    };

    const output = engine.execute(input);

    expect(output.engineName).toBe('ZScoreEngine');
    expect(output.metadata.status).toBe('SUCCESS');
    expect(output.diagnostics.mean).toBe(18);
    expect(output.diagnostics.variance).toBeCloseTo(27.428);
    expect(output.diagnostics.zScore).toBe(0);
    expect(output.confidence).toBeGreaterThan(0);
    expect(output.diagnostics.sampleSize).toBe(8);
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

  it('should implement IZScoreEngine contract successfully', () => {
    const context: DecisionContext = {
      sessionId: 'sess4',
      timestamp: new Date().toISOString(),
      recentHistory: [30, 30, 30], // Positive zScore
      activeStrategies: []
    };

    const zScore = engine.calculateZScore(context);
    expect(zScore).toBeGreaterThan(0);
  });

  it('should handle all invalid spins as FAILED', () => {
    const input: QuantitativeInput = {
      sessionId: 'sess5',
      timestamp: new Date().toISOString(),
      recentSpins: [99, -5, NaN] as unknown as number[],
      analyzedWindow: 3,
      executionParameters: {}
    };

    const output = engine.execute(input);

    expect(output.metadata.status).toBe('FAILED');
    expect(output.metadata.messages[0]).toMatch(/INSUFFICIENT_DATA/);
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
    expect(outputs[0].engineName).toBe('ZScoreEngine');
    expect(outputs[0].metadata.status).toBe('SUCCESS');
  });

  it('should be compatible with DecisionIntelligenceCoordinator', () => {
    // Mock the other engines
    const mockProb = { calculateProbabilities: () => ({}) };
    const mockEntropy = { calculateEntropy: () => 0 };
    const mockVix = { calculateVix: () => 50 };
    const mockStrategy = { rankStrategies: () => [] };
    
    const coordinator = new DecisionIntelligenceCoordinator(
      mockProb as unknown as IProbabilityEngine,
      mockEntropy as unknown as IEntropyEngine,
      engine,
      mockVix as unknown as IVixEngine,
      mockStrategy as unknown as IStrategyRankingEngine
    );
    
    const context: DecisionContext = {
      sessionId: 'sess7',
      timestamp: new Date().toISOString(),
      recentHistory: [5, 24, 16, 33, 1, 20],
      activeStrategies: []
    };
    
    const result = coordinator.analyze(context);
    expect(result.metrics.zScoreValue).toBeDefined();
    expect(typeof result.metrics.zScoreValue).toBe('number');
  });
});
