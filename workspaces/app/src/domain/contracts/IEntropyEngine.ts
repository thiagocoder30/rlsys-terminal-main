import { DecisionContext } from '../intelligence/DecisionContext';

export interface IEntropyEngine {
  calculateEntropy(context: DecisionContext): number;
}
