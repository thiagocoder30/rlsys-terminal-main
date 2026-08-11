export interface QuantitativeInput {
  readonly sessionId: string;
  readonly timestamp: string;
  readonly recentSpins: number[];
  readonly analyzedWindow: number;
  readonly executionParameters: Record<string, unknown>;
}
