#!/usr/bin/env bash
set -euo pipefail

echo "======================================"
echo " RL.SYS CORE - SPRINT 440"
echo " ZERO-ALLOCATION EVENT BUS"
echo "======================================"

ROOT_DIR=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$ROOT_DIR"

echo "[1/2] A instanciar o Barramento de Eventos Síncrono (Observer Pattern)..."
mkdir -p src/application/runtime

cat > src/application/runtime/RuntimeEventBus.ts <<'EOF'
/**
 * @file RuntimeEventBus.ts
 * @description Barramento de eventos central do RL.SYS. 
 * Implementa o padrão Observer em O(1) e utiliza o SignalObjectPool para garantir 
 * Zero-Allocation, prevenindo paragens do Garbage Collector no Helio P22.
 */

import { SignalObjectPool, PooledSignal } from '../../domain/memory/SignalObjectPool';

/**
 * Assinatura estrita para subscritores. 
 * REGRA INSTITUCIONAL: Handlers DEVEM ser síncronos para permitir a reciclagem imediata do sinal.
 */
export type SignalHandler = (signal: PooledSignal) => void;

export class RuntimeEventBus {
    private readonly pool: SignalObjectPool;
    private readonly subscribers: Set<SignalHandler> = new Set();

    /**
     * @param poolCapacity Capacidade pré-alocada na RAM para suportar picos de volatilidade.
     */
    constructor(poolCapacity: number = 250) {
        this.pool = new SignalObjectPool(poolCapacity);
    }

    /**
     * Regista um novo módulo para escutar os sinais da mesa.
     */
    public subscribe(handler: SignalHandler): void {
        this.subscribers.add(handler);
    }

    /**
     * Remove um módulo da lista de escuta (evita Memory Leaks de referências perdidas).
     */
    public unsubscribe(handler: SignalHandler): void {
        this.subscribers.delete(handler);
    }

    /**
     * Emite um sinal quantitativo para todos os módulos conectados sem utilizar a palavra-chave 'new'.
     * @param id Identificador único do evento.
     * @param targetSector Setor ou alvo calculado.
     * @param confidence Grau de confiança (0-100) gerado pelo motor de convergência.
     * @param strategyId ID exato da estratégia (ex: CROSS_GRID_HEDGE).
     */
    public dispatchSignal(id: string, targetSector: number, confidence: number, strategyId: string): void {
        const signal = this.pool.acquire();
        
        if (!signal) {
            // Em HFT, se a pool esgotar, descartamos o sinal para não corromper o Event Loop.
            console.error('[CRITICAL] SignalObjectPool esgotada. Sinal descartado para proteger a CPU.');
            return;
        }

        // Preenchimento do objeto reciclado (Zero-Allocation)
        signal.id = id;
        signal.targetSector = targetSector;
        signal.confidence = confidence;
        signal.strategyId = strategyId;

        try {
            // Notificação síncrona aos subscritores
            for (const handler of this.subscribers) {
                handler(signal);
            }
        } finally {
            // Libertação imediata: O objeto regressa à piscina no mesmo ciclo de relógio.
            this.pool.release(signal);
        }
    }
    
    /**
     * Retorna a quantidade de handlers ativos (Telemetria).
     */
    public getActiveSubscribersCount(): number {
        return this.subscribers.size;
    }
}
EOF

echo "[2/2] A registar a arquitetura reativa no controlo de versão..."
git add src/application/runtime/RuntimeEventBus.ts
git add install/sprints/run-sprint-440-zero-allocation-event-bus.sh
git commit -m "feat(runtime): implement RuntimeEventBus using Observer pattern tightly coupled with SignalObjectPool to ensure O(1) zero-allocation synchronous event dispatching (Sprint 440)" > /dev/null

echo "======================================"
echo -e "\033[1;32m SPRINT 440 INSTALADA COM SUCESSO \033[0m"
echo " STATUS: EVENT BUS ZERO-ALLOCATION ATIVADO"
echo "======================================"
