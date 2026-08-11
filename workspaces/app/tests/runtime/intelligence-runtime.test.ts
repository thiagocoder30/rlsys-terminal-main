import { describe, it, expect, vi } from 'vitest';
import { IntelligenceRuntime } from '../../src/runtime/IntelligenceRuntime';
import { QuantitativeEnginePipeline } from '../../src/application/intelligence/QuantitativeEnginePipeline';
import { IDecisionIntelligenceEngine } from '../../src/domain/contracts/IDecisionIntelligenceEngine';
import { ExplainabilityCoordinator } from '../../src/application/intelligence/ExplainabilityCoordinator';
import { IDecisionAuditLedger } from '../../src/domain/contracts/IDecisionAuditLedger';
import { QuantitativeInput } from '../../src/domain/intelligence/common/QuantitativeInput';
import { QuantitativeEngineRegistry } from '../../src/application/intelligence/QuantitativeEngineRegistry';
import { IExplainabilityEngine } from '../../src/domain/contracts/IExplainabilityEngine';

describe('IntelligenceRuntime', () => {
  it('should orchestrate pipeline, decision, explainability, and audit', () => {
    const registry = new QuantitativeEngineRegistry();
    const pipeline = new QuantitativeEnginePipeline(registry);
    
    vi.spyOn(pipeline, 'executeAll').mockReturnValue([]);

    const mockDecisionEngine: IDecisionIntelligenceEngine = {
      analyze: vi.fn().mockReturnValue({
        processingMetadata: { status: 'SUCCESS' },
        diagnostics: {}
      })
    };

    const mockExplainabilityEngine: IExplainabilityEngine = {
      generateExplanation: vi.fn().mockReturnValue({
        processingMetadata: { status: 'SUCCESS' }
      })
    };
    
    const explainabilityCoordinator = new ExplainabilityCoordinator(mockExplainabilityEngine);
    vi.spyOn(explainabilityCoordinator, 'explain');

    const mockLedger: IDecisionAuditLedger = {
      append: vi.fn(),
      logDecision: vi.fn(),
      verifyIntegrity: vi.fn().mockReturnValue(true),
      getHistory: vi.fn().mockReturnValue([])
    };

    const runtime = new IntelligenceRuntime(
      pipeline,
      mockDecisionEngine,
      explainabilityCoordinator,
      mockLedger
    );

    const input: QuantitativeInput = {
      sessionId: 'sess-abc',
      timestamp: new Date().toISOString(),
      recentSpins: [0, 32],
      analyzedWindow: 2,
      executionParameters: { activeStrategies: ['stratA'] }
    };

    const result = runtime.execute(input);

    expect(pipeline.executeAll).toHaveBeenCalledWith(input);
    expect(mockDecisionEngine.analyze).toHaveBeenCalled();
    expect(explainabilityCoordinator.explain).toHaveBeenCalled();
    expect(mockLedger.append).toHaveBeenCalled();
    
    expect(result.runtimeStatus).toBe('SUCCESS');
    expect(result.summary).toBeDefined();
    expect(result.explanation).toBeDefined();
  });
});
