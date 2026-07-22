export interface DecisionResult {
  approved: boolean;
  strategy: string | null;
  confidence: number;
  stake: number;
  reason: string;
  analysis: Record<string, unknown>;
}
