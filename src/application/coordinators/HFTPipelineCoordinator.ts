/**
 * @file HFTPipelineCoordinator.ts
 * @description Orquestra o fluxo de dados em alta frequência (HFT). 
 * Conecta o motor analítico, o filtro de decaimento EMA, o motor de convergência 
 * e o barramento de eventos em um único pipeline síncrono e de baixa latência O(1).
 */

import { RuntimeEventBus } from '../runtime/RuntimeEventBus';
import { RegimeConvergenceEngine, ConfirmedOpeningStrategy, RuntimeMetrics } from '../../domain/intelligence/RegimeConvergenceEngine';
import { DecayCompensationFilter } from '../../domain/intelligence/DecayCompensationFilter';

export class HFTPipelineCoordinator {
    private readonly eventBus: RuntimeEventBus;
    private readonly convergenceEngine: RegimeConvergenceEngine;
    private readonly decayFilter: DecayCompensationFilter;

    /**
     * @param eventBus Barramento reativo para injeção de sinais.
     * @param windowSize Tamanho estático da janela de análise (padrão: 85).
     */
    constructor(eventBus: RuntimeEventBus, windowSize: number = 85) {
        this.eventBus = eventBus;
        this.decayFilter = new DecayCompensationFilter(0.2); // Alpha 0.2 para suavização institucional
        const strategy = new ConfirmedOpeningStrategy();
        this.convergenceEngine = new RegimeConvergenceEngine(windowSize, strategy);
    }

    /**
     * Processa um novo tick (giro da mesa) através do pipeline quantitativo.
     * @param rawConvergence Convergência bruta extraída da mesa.
     * @param rawDecision Score base de decisão.
     * @param rawConfidence Confiança estrutural.
     * @param rawDecay Taxa de degradação atual (decay).
     * @param prospectiveStrategyId ID da estratégia identificada (ex: CROSS_GRID_HEDGE).
     * @param targetSector Setor alvo ou coluna associada à operação.
     */
    public processTick(
        rawConvergence: number,
        rawDecision: number,
        rawConfidence: number,
        rawDecay: number,
        prospectiveStrategyId: string,
        targetSector: number
    ): void {
        // 1. Filtragem de ruído no decaimento via EMA O(1)
        const smoothedDecay = this.decayFilter.apply(rawDecay);

        // 2. Encapsulamento de métricas imutáveis
        const metrics: RuntimeMetrics = {
            convergence: rawConvergence,
            decisionScore: rawDecision,
            windowConfidence: rawConfidence,
            decay: smoothedDecay
        };

        // 3. Processamento de Decisão (Validação do Regime)
        const decisionResult = this.convergenceEngine.processDecision(metrics);

        // 4. Disparo Reativo se Qualificado
        if (decisionResult.success && decisionResult.value === true) {
            // Emite o sinal pelo EventBus (utilizando a pool para Zero-Allocation)
            const signalId = `SIG-${Date.now()}`;
            this.eventBus.dispatchSignal(
                signalId,
                targetSector,
                metrics.windowConfidence,
                prospectiveStrategyId
            );
        } else if (!decisionResult.success) {
            console.error(`[PIPELINE_ERROR] Falha na convergência: ${decisionResult.error}`);
        }
    }

    /**
     * Reseta o estado dinâmico do pipeline (acionado em eventos de troca de banca ou zeramento da mesa).
     */
    public resetPipeline(): void {
        this.decayFilter.reset();
        // O RegimeConvergenceEngine é mantido ou recriado pela camada superior se necessário,
        // mas em arquiteturas Zero-Allocation preferimos limpar ponteiros.
    }
}
