import { DecisionSummary } from '../intelligence/decision/DecisionSummary';
import { DecisionExplanation } from '../intelligence/explainability/DecisionExplanation';

export interface IExplainabilityEngine {
  generateExplanation(summary: DecisionSummary): DecisionExplanation;
}
