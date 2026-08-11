import { describe, it, expect } from 'vitest';
import { ExplainabilityCoordinator } from '../../../src/application/intelligence/ExplainabilityCoordinator';
import { ExplainabilityEngine } from '../../../src/domain/intelligence/explainability/ExplainabilityEngine';
import { DecisionSummary } from '../../../src/domain/intelligence/decision/DecisionSummary';

describe('ExplainabilityCoordinator', () => {
  it('should orchestrate explanation generation correctly', () => {
    const engine = new ExplainabilityEngine();
    const coordinator = new ExplainabilityCoordinator(engine);
    
    const mockSummary = {
      globalConfidence: 0.5,
      processingMetadata: { durationMs: 0, timestamp: '', status: 'SUCCESS' as const },
      diagnostics: { sessionId: 'xyz' }
    } as unknown as DecisionSummary;

    const explanation = coordinator.explain(mockSummary);
    
    expect(explanation).toBeDefined();
    expect(explanation.sourceDecisionId).toBe('xyz');
  });
});
