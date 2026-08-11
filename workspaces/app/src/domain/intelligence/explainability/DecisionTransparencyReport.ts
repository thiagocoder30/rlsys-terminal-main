import { DecisionConfidenceBreakdown } from './DecisionConfidenceBreakdown';
import { DecisionExplanationSection } from './DecisionExplanationSection';
import { DecisionReason } from './DecisionReason';

export interface DecisionTransparencyReport {
  readonly summary: string;
  readonly sections: DecisionExplanationSection[];
  readonly reasons: DecisionReason[];
  readonly confidenceBreakdown: DecisionConfidenceBreakdown;
  readonly enginesConsulted: string[];
  readonly architectureVersion: string;
}
