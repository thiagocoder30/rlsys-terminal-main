/**
 * RL.SYS CORE — DecisionContext Contract (DEV000.4-001)
 * Contrato base imutável que representa o estado de entrada para o Decision Intelligence Core.
 */

export interface StrategyPerformanceMetrics {
    readonly pnl: number;
    readonly weight: number;
    readonly wins: number;
    readonly losses: number;
}

export interface DecisionContext {
    readonly sessionId: string;
    readonly timestamp: number;
    readonly timeline: readonly number[];
    readonly bankroll: number;
    readonly baseBankroll: number;
    readonly vix: number;
    readonly markovMatrix: readonly (readonly number[])[];
    readonly strategyPerformance: Readonly<Record<string, StrategyPerformanceMetrics>>;
    readonly cooldown: number;
    readonly burnIn: number;
    readonly provider: string;
}

