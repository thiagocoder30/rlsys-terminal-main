import { describe, it, expect } from 'vitest';
import { DecisionExplanation } from '../../../../src/domain/intelligence/explainability/DecisionExplanation';

describe('DecisionExplanation', () => {
  it('should be a valid data structure holding all institutional report parts', () => {
    const explanation: DecisionExplanation = {
      explanationId: 'expl-001',
      timestamp: '2026-07-26T00:00:00Z',
      sourceDecisionId: 'session-777',
      overallExplanation: 'Testing explanation object',
      evidenceBundle: {
        markovReferences: {},
        shannonReferences: {},
        vixReferences: {},
        zScoreReferences: {},
        strategyRankingReferences: {}
      },
      transparencyReport: {
        summary: 'report',
        sections: [],
        reasons: [],
        confidenceBreakdown: { quantitativeConfidence: 1, riskConfidence: 1, stabilityConfidence: 1 },
        enginesConsulted: [],
        architectureVersion: 'RL.SYS CORE v5.x'
      },
      processingMetadata: {
        durationMs: 5,
        status: 'SUCCESS'
      }
    };

    expect(explanation.explanationId).toBe('expl-001');
    expect(explanation.transparencyReport.architectureVersion).toBe('RL.SYS CORE v5.x');
  });
});
