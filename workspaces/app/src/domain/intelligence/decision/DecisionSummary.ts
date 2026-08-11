import { DecisionAnalysis } from './DecisionAnalysis';

export interface DecisionProcessingMetadata {
  readonly durationMs: number;
  readonly timestamp: string;
  readonly status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
}

export interface DecisionSummary {
  readonly probabilitySummary: DecisionAnalysis<Record<string, unknown>>;
  readonly entropySummary: DecisionAnalysis<number>;
  readonly vixSummary: DecisionAnalysis<number>;
  readonly zScoreSummary: DecisionAnalysis<number>;
  readonly rankingSummary: DecisionAnalysis<Record<string, unknown>>;
  readonly globalConfidence: number;
  readonly processingMetadata: DecisionProcessingMetadata;
  readonly diagnostics: Record<string, unknown>;
}
