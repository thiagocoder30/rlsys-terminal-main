import { DecisionResult } from '../../src/decision/DecisionResult';

describe('DecisionResult interface', () => {
  it('should accept a valid DecisionResult object when approved', () => {
    const result: DecisionResult = {
      approved: true,
      strategy: 'WinningStrategy',
      confidence: 0.92,
      stake: 50,
      reason: 'High confidence and low risk',
      analysis: { metric: 0.95, details: 'All checks passed' },
    };

    expect(result).toMatchObject({
      approved: true,
      strategy: expect.any(String),
      confidence: expect.any(Number),
      stake: expect.any(Number),
      reason: expect.any(String),
      analysis: expect.any(Object),
    });
  });

  it('should accept a valid DecisionResult object when not approved', () => {
    const result: DecisionResult = {
      approved: false,
      strategy: null,
      confidence: 0.4,
      stake: 0,
      reason: 'Insufficient data',
      analysis: { metric: 0.4, details: 'Data incomplete' },
    };

    expect(result).toMatchObject({
      approved: false,
      strategy: null,
      confidence: expect.any(Number),
      stake: expect.any(Number),
      reason: expect.any(String),
      analysis: expect.any(Object),
    });
  });
});
