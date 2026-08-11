export interface DecisionContext {
  readonly sessionId: string;
  readonly timestamp: string;
  readonly recentHistory: number[];
  readonly activeStrategies: string[];
}
