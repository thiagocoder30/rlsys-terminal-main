/**
 * RL.SYS CORE — DecisionResult Contract (DEV000.4-001)
 * Contrato base imutável que representa a saída do Decision Intelligence Core.
 */

export interface DecisionAnalysisPayload {
    readonly entropy: number;
    readonly zScore: number;
    readonly markovConfidence: number;
    readonly sectorConcentration: number;
}

export interface DecisionResult {
    readonly approved: boolean;
    readonly strategy: string | null;
    readonly confidence: number;
    readonly stake: number;
    readonly reason: string;
    readonly analysis: DecisionAnalysisPayload;
    readonly timestamp: number;
}

