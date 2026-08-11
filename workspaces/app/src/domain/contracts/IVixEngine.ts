import { DecisionContext } from '../intelligence/DecisionContext';

export interface IVixEngine {
  calculateVix(context: DecisionContext): number;
}
