#!/usr/bin/env bash
set -euo pipefail

echo "======================================"
echo " RL.SYS CORE - SPRINT 439"
echo " ZERO-GARBAGE SIGNAL OBJECT POOL"
echo "======================================"

ROOT_DIR=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$ROOT_DIR"

echo "[1/2] Injetando Pool de Reciclagem de Objetos (Prevenção de Stop-The-World GC)..."
mkdir -p src/domain/memory

cat > src/domain/memory/SignalObjectPool.ts <<'EOF'
/**
 * @file SignalObjectPool.ts
 * @description Padrão arquitetural Object Pool para evitar a alocação dinâmica e a coleta de lixo (GC)
 * durante a geração de sinais de alta frequência. Crucial para mitigar Event Loop Lag no Helio P22.
 */

export interface PooledSignal {
    id: string;
    targetSector: number;
    confidence: number;
    strategyId: string;
    active: boolean;
}

export class SignalObjectPool {
    private readonly pool: PooledSignal[];
    private readonly capacity: number;
    private searchPointer: number = 0;

    /**
     * @param capacity Número fixo de objetos pré-alocados no momento do boot.
     */
    constructor(capacity: number = 250) {
        this.capacity = capacity;
        this.pool = new Array<PooledSignal>(capacity);
        
        // Instanciação agressiva no boot (Warm-up da Memória RAM)
        for (let i = 0; i < capacity; i++) {
            this.pool[i] = {
                id: '',
                targetSector: -1,
                confidence: 0,
                strategyId: '',
                active: false
            };
        }
    }

    /**
     * Adquire um objeto reciclado da piscina em tempo O(1) amortizado.
     * Sem uso de `new`, impedindo a fragmentação da memória heap.
     */
    public acquire(): PooledSignal | null {
        for (let i = 0; i < this.capacity; i++) {
            const index = (this.searchPointer + i) % this.capacity;
            const candidate = this.pool[index];
            
            if (!candidate.active) {
                this.searchPointer = (index + 1) % this.capacity;
                candidate.active = true;
                return candidate;
            }
        }
        
        // Proteção Institucional: Pool Exhaustion
        return null; 
    }

    /**
     * Devolve o objeto à piscina, zerando suas propriedades primitivas.
     * @param signal O objeto sinal previamente adquirido.
     */
    public release(signal: PooledSignal): void {
        signal.id = '';
        signal.targetSector = -1;
        signal.confidence = 0;
        signal.strategyId = '';
        signal.active = false;
    }
    
    /**
     * Obtém a métrica de pressão de alocação em tempo real para a telemetria.
     */
    public getActiveCount(): number {
        let count = 0;
        for (let i = 0; i < this.capacity; i++) {
            if (this.pool[i].active) count++;
        }
        return count;
    }
}
EOF

echo "[2/2] Registrando Design Pattern na governança arquitetural..."
git add src/domain/memory/SignalObjectPool.ts
git add install/sprints/run-sprint-439-signal-object-pool.sh
git commit -m "perf(memory): implement Object Pool design pattern via SignalObjectPool to eliminate dynamic allocations and prevent GC Stop-The-World spikes on constrained edge hardware (Sprint 439)" > /dev/null

echo "======================================"
echo -e "\033[1;32m SPRINT 439 APLICADA COM SUCESSO \033[0m"
echo " STATUS: PREVENÇÃO DE GC ATIVADA (ZERO-GARBAGE)"
echo "======================================"
