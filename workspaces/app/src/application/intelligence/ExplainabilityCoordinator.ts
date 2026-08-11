import { IExplainabilityEngine } from '../../domain/contracts/IExplainabilityEngine';
import { DecisionSummary } from '../../domain/intelligence/decision/DecisionSummary';
import { DecisionExplanation } from '../../domain/intelligence/explainability/DecisionExplanation';

export class ExplainabilityCoordinator {
  constructor(private readonly explainabilityEngine: IExplainabilityEngine) {}

  public explain(summary: DecisionSummary): DecisionExplanation {
    return this.explainabilityEngine.generateExplanation(summary);
  }
}
