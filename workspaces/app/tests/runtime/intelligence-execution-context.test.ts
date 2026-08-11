import { describe, it, expect } from 'vitest';
import { IntelligenceExecutionContext } from '../../src/runtime/context/IntelligenceExecutionContext';
import { QuantitativeInput } from '../../src/domain/intelligence/common/QuantitativeInput';

describe('IntelligenceExecutionContext', () => {
  it('should hold immutable context state', () => {
    const input: QuantitativeInput = {
      sessionId: 'sess-123',
      timestamp: '2026-07-26T00:00:00Z',
      recentSpins: [1, 2, 3],
      analyzedWindow: 3,
      executionParameters: {}
    };

    const context: IntelligenceExecutionContext = {
      executionId: 'exec-456',
      timestamp: '2026-07-26T00:00:01Z',
      input,
      runtimeMetadata: { version: '1.0' },
      correlationId: 'sess-123'
    };

    expect(context.executionId).toBe('exec-456');
    expect(context.correlationId).toBe('sess-123');
    expect(context.input.recentSpins).toEqual([1, 2, 3]);
  });
});
