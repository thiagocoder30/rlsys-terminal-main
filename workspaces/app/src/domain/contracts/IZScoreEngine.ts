import { DecisionContext } from '../intelligence/DecisionContext';

export interface IZScoreEngine {
  calculateZScore(context: DecisionContext): number;
}
