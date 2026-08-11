import { describe, it, expect } from 'vitest';
import { DecisionSummary } from '../../../../src/domain/intelligence/decision/DecisionSummary';

describe('DecisionSummary', () => {
  it('should correctly define DecisionSummary interface shape', () => {
    const summary: DecisionSummary = {
      probabilitySummary: { engineName: 'A', status: 'SUCCESS', score: 10, value: {}, messages: [] },
      entropySummary: { engineName: 'B', status: 'SUCCESS', score: 5, value: 1, messages: [] },
      vixSummary: { engineName: 'C', status: 'SUCCESS', score: 20, value: 5, messages: [] },
      zScoreSummary: { engineName: 'D', status: 'SUCCESS', score: 1, value: 0, messages: [] },
      rankingSummary: { engineName: 'E', status: 'SUCCESS', score: 100, value: {}, messages: [] },
      globalConfidence: 1,
      processingMetadata: {
        durationMs: 10,
        timestamp: new Date().toISOString(),
        status: 'SUCCESS'
      },
      diagnostics: {}
    };

    expect(summary.globalConfidence).toBe(1);
    expect(summary.processingMetadata.status).toBe('SUCCESS');
    expect(summary.probabilitySummary.engineName).toBe('A');
  });
});
