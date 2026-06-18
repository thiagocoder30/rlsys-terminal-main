/**
 * @file InstitutionalStrategyAllocationEngine.ts
 * @description Módulo de Alocação Institucional (Fase 3 - Evolution).
 * Resolve a competição interna de estratégias. Em vez de uma decisão linear,
 * múltiplas estratégias são avaliadas contra a janela temporal (Window Phase),
 * e o motor aloca o "direito de execução" àquela com maior eficiência (Score).
 */

export interface StrategyCompetitor {
    readonly id: string;
    readonly name: string;
    evaluate(currentNumber: number, previousNumber: number): { status: string; netAmount: number };
}

export interface AllocationResult {
    readonly winningStrategyId: string | null;
    readonly targetSector: number;
    readonly confidenceMatch: number; // Força da vitória na competição (0-100)
}

export class InstitutionalStrategyAllocationEngine {
    private readonly evaluationWindowSize: number;

    /**
     * @param evaluationWindowSize Tamanho da fita (timeline) usada para a arena de competição (Padrão: 15).
     */
    constructor(evaluationWindowSize: number = 15) {
        this.evaluationWindowSize = evaluationWindowSize;
    }

    /**
     * Roda o algoritmo de competição interna.
     * Complexidade: O(S * W) onde S = número de estratégias e W = tamanho da janela.
     * * @param operationalHistory Histórico limpo do Tracker.
     * @param registeredStrategies Dicionário de estratégias instanciadas no sistema.
     * @param allowedStrategies Lista de IDs permitidos pela governança (Performance Evaluator).
     * @returns O ID da estratégia vencedora e as coordenadas do alvo (Target Sector).
     */
    public allocateCapital(
        operationalHistory: number[],
        registeredStrategies: Record<string, StrategyCompetitor>,
        allowedStrategies: Set<string>
    ): AllocationResult {
        if (operationalHistory.length < this.evaluationWindowSize) {
            return { winningStrategyId: null, targetSector: -1, confidenceMatch: 0 };
        }

        const timeline = operationalHistory.slice(-this.evaluationWindowSize);
        const anchorNumber = operationalHistory[operationalHistory.length - 1]; // Último número sorteado
        const scores: Record<string, number> = {};

        // 1. Inicializa placar apenas para estratégias permitidas e ativas
        Object.keys(registeredStrategies).forEach(stratId => {
            if (allowedStrategies.has(stratId)) {
                scores[stratId] = 0;
            }
        });

        if (Object.keys(scores).length === 0) {
            return { winningStrategyId: null, targetSector: -1, confidenceMatch: 0 };
        }

        // 2. Arena de Competição (Backtest na Janela Temporal)
        timeline.forEach((num, index) => {
            const prevNum = index > 0 ? timeline[index - 1] : 0;
            Object.keys(scores).forEach(stratId => {
                const strat = registeredStrategies[stratId];
                const result = strat.evaluate(num, prevNum);
                
                // Pontuação por eficiência de capital (HFT focus)
                if (result.status === 'WIN_MAX' || result.status === 'WIN_MIN') {
                    scores[stratId] += 1;
                } else if (result.status === 'LOSS') {
                    scores[stratId] -= 0.5; // Penalidade institucional
                }
            });
        });

        // 3. Resolução do Vencedor (Sorting O(N))
        let bestStrat: string | null = null;
        let maxScore = -Infinity;

        Object.entries(scores).forEach(([stratId, score]) => {
            if (score > maxScore) {
                maxScore = score;
                bestStrat = stratId;
            }
        });

        // 4. Barreira de Qualificação (Threshold)
        // A estratégia deve ter um aproveitamento positivo mínimo para ganhar o direito de execução
        const minimumScoreThreshold = this.evaluationWindowSize * 0.35; // 35% de assertividade pura na janela

        if (!bestStrat || maxScore < minimumScoreThreshold) {
            return { winningStrategyId: null, targetSector: -1, confidenceMatch: 0 };
        }

        // 5. Mapeamento de Setor Alvo (Target Sector Mapping)
        let targetSector = -1;
        if (bestStrat === 'CROSS_GRID_HEDGE') {
            if (anchorNumber >= 1 && anchorNumber <= 12) targetSector = 23;
            else if (anchorNumber >= 13 && anchorNumber <= 24) targetSector = 13;
            else if (anchorNumber >= 25 && anchorNumber <= 36) targetSector = 12;
        }

        // Cálculo da força da vitória (Normalizado 0-100)
        const confidenceMatch = Math.min(100, Math.round((maxScore / this.evaluationWindowSize) * 100));

        return {
            winningStrategyId: bestStrat,
            targetSector,
            confidenceMatch
        };
    }
}
