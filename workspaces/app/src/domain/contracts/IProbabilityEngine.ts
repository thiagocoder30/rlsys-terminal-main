import { DecisionContext } from '../intelligence/DecisionContext';

export interface IProbabilityEngine {
  calculateProbabilities(context: DecisionContext): Record<string, unknown>;
}
