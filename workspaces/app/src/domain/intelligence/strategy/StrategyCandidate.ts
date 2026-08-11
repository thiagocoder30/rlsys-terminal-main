export interface StrategyCandidate {
  id: string;
  name: string;
  description?: string;
  baseWinRate: number; 
  riskMultiplier: number;
}
