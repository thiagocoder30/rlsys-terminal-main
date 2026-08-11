import { DecisionSummary } from '../../domain/intelligence/decision/DecisionSummary';
import { DecisionExplanation } from '../../domain/intelligence/explainability/DecisionExplanation';

export interface IntelligenceExecutionResult {
  readonly summary: DecisionSummary;
  readonly explanation: DecisionExplanation;
  readonly executionMetadata: Record<string, unknown>;
  readonly processingTime: number;
  readonly runtimeStatus: 'SUCCESS' | 'PARTIAL' | 'FAILED';
  readonly diagnostics: Record<string, unknown>;
}
