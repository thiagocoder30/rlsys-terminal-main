import { describe, it, expect } from 'vitest';
import { DecisionReason } from '../../../../src/domain/intelligence/explainability/DecisionReason';

describe('DecisionReason', () => {
  it('should be a valid data transfer object', () => {
    const reason: DecisionReason = {
      id: 'reason-123',
      category: 'Probability Analysis',
      description: 'Alta concentração probabilística detectada',
      importance: 'HIGH',
      evidence: { source: 'MarkovProbabilityEngine' }
    };

    expect(reason.id).toBe('reason-123');
    expect(reason.category).toBe('Probability Analysis');
    expect(reason.description).toBeDefined();
    expect(reason.importance).toBe('HIGH');
  });
});
