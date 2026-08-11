import { describe, it, expect } from 'vitest';
import { IntelligenceExecutionResult } from '../../src/runtime/result/IntelligenceExecutionResult';
import { DecisionSummary } from '../../src/domain/intelligence/decision/DecisionSummary';
import { DecisionExplanation } from '../../src/domain/intelligence/explainability/DecisionExplanation';

describe('IntelligenceExecutionResult', () => {
  it('should encapsulate the full execution cycle', () => {
    const mockSummary = {} as DecisionSummary;
    const mockExplanation = {} as DecisionExplanation;

    const result: IntelligenceExecutionResult = {
      summary: mockSummary,
      explanation: mockExplanation,
      executionMetadata: { executionId: 'exec-1' },
      processingTime: 10,
      runtimeStatus: 'SUCCESS',
      diagnostics: {}
    };

    expect(result.runtimeStatus).toBe('SUCCESS');
    expect(result.processingTime).toBe(10);
    expect(result.executionMetadata.executionId).toBe('exec-1');
  });
});
