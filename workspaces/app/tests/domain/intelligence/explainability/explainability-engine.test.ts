import { describe, it, expect } from 'vitest';
import { ExplainabilityEngine } from '../../../../src/domain/intelligence/explainability/ExplainabilityEngine';
import { DecisionSummary } from '../../../../src/domain/intelligence/decision/DecisionSummary';

describe('ExplainabilityEngine', () => {
  const mockSummary: DecisionSummary = {
    probabilitySummary: { score: 100, confidence: 0.9, details: {}, diagnostics: { msg: 'markov' } },
    entropySummary: { score: 50, confidence: 0.8, details: 0, diagnostics: {} },
    vixSummary: { score: 30, confidence: 0.7, details: 0, diagnostics: {} },
    zScoreSummary: { score: 10, confidence: 0.6, details: 0, diagnostics: {} },
    rankingSummary: { score: 90, confidence: 0.95, details: {}, diagnostics: {} },
    globalConfidence: 0.85,
    processingMetadata: { durationMs: 15, timestamp: new Date().toISOString(), status: 'SUCCESS' },
    diagnostics: { sessionId: 'test-session-xyz' }
  };

  it('should generate an explanation from a DecisionSummary without mutating it', () => {
    const originalSummaryStr = JSON.stringify(mockSummary);
    const engine = new ExplainabilityEngine();
    
    const explanation = engine.generateExplanation(mockSummary);
    
    expect(explanation).toBeDefined();
    expect(explanation.explanationId).toBeDefined();
    expect(explanation.sourceDecisionId).toBe('test-session-xyz');
    expect(explanation.transparencyReport.enginesConsulted.length).toBe(5);
    expect(explanation.transparencyReport.reasons.length).toBe(5);
    expect(explanation.processingMetadata.status).toBe('SUCCESS');
    
    // Ensure DecisionSummary remained immutable
    expect(JSON.stringify(mockSummary)).toBe(originalSummaryStr);
  });

  it('should handle partial or missing DecisionSummary gracefully', () => {
    const emptySummary = {} as DecisionSummary;
    const engine = new ExplainabilityEngine();
    const explanation = engine.generateExplanation(emptySummary);

    expect(explanation).toBeDefined();
    expect(explanation.transparencyReport.enginesConsulted.length).toBe(0);
    expect(explanation.processingMetadata.status).toBe('PARTIAL');
  });
});
