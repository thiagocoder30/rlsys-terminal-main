export interface StrategyPerformance {
  strategy: string;
  score: number;
  confidence: number;
}

export interface DecisionContext {
  timeline: number[];
  bankroll: number;
  vix: number;
  markovMatrix: number[];
  strategyPerformance: StrategyPerformance[];
  cooldown: number;
  burnIn: number;
}
