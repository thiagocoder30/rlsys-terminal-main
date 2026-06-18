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
