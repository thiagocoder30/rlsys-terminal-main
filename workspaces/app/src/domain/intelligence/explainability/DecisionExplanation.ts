import { DecisionTransparencyReport } from './DecisionTransparencyReport';
import { DecisionEvidenceBundle } from './DecisionEvidenceBundle';

export interface DecisionExplanation {
  readonly explanationId: string;
  readonly timestamp: string;
  readonly sourceDecisionId: string;
  readonly overallExplanation: string;
  readonly evidenceBundle: DecisionEvidenceBundle;
  readonly transparencyReport: DecisionTransparencyReport;
  readonly processingMetadata: {
    readonly durationMs: number;
    readonly status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
  };
}
