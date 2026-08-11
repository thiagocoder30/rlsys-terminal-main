export interface StrategyScore {
  candidateId: string;
  overallScore: number;
  probabilityContribution: number;
  entropyContribution: number;
  vixContribution: number;
  zScoreContribution: number;
  confidenceContribution: number;
  riskPenalty: number;
  finalScore: number;
}
