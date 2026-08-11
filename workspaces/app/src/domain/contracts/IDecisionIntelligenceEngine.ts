import { DecisionContext } from '../intelligence/DecisionContext';
import { DecisionSummary } from '../intelligence/decision/DecisionSummary';

export interface IDecisionIntelligenceEngine {
  analyze(context: DecisionContext): DecisionSummary;
}
