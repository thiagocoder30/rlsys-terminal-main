/**
 * @file RegimeConvergenceEngine.ts
 * @description Núcleo de cálculo de convergência institucional e decisão estatística de alta frequência.
 * Otimizado para cenários de restrição severa de hardware (Helio P22, 2GB RAM).
 */

export type ExecutionResult<T, E> = 
    | { success: true; value: T } 
    | { success: false; error: E };

export interface RuntimeMetrics {
    readonly convergence: number;
    readonly decisionScore: number;
    readonly windowConfidence: number;
    readonly decay: number;
}

export interface IExecutionStrategy {
    readonly regimeIdentifier: string;
    evaluate(metrics: RuntimeMetrics): boolean;
}

export class ConfirmedOpeningStrategy implements IExecutionStrategy {
    public readonly regimeIdentifier: string = 'CONFIRMED_OPENING';
    
    private readonly minConvergence: number = 70;
    private readonly minDecisionScore: number = 65;
    private readonly minConfidence: number = 80;

    public evaluate(metrics: RuntimeMetrics): boolean {
        return metrics.convergence >= this.minConvergence &&
               metrics.decisionScore >= this.minDecisionScore &&
               metrics.windowConfidence >= this.minConfidence &&
               metrics.decay > -10;
    }
}

export class RegimeConvergenceEngine {
    private readonly ringBuffer: Float64Array;
    private readonly bufferSize: number;
    private headPointer: number = 0;
    private totalElements: number = 0;
    private activeStrategy: IExecutionStrategy;

    constructor(staticWindowSize: number, initialStrategy: IExecutionStrategy) {
        this.bufferSize = staticWindowSize;
        // Alocação estática para evitar Garbage Collection em tempo de execução
        this.ringBuffer = new Float64Array(staticWindowSize);
        this.activeStrategy = initialStrategy;
    }

    public setStrategy(newStrategy: IExecutionStrategy): void {
        this.activeStrategy = newStrategy;
    }

    public pushScore(score: number): void {
        this.ringBuffer[this.headPointer] = score;
        this.headPointer = (this.headPointer + 1) % this.bufferSize;
        if (this.totalElements < this.bufferSize) {
            this.totalElements++;
        }
    }

    public calculateHistoricalAverage(): number {
        if (this.totalElements === 0) return 0;
        let sum = 0;
        for (let i = 0; i < this.totalElements; i++) {
            sum += this.ringBuffer[i];
        }
        return sum / this.totalElements;
    }

    public processDecision(metrics: RuntimeMetrics): ExecutionResult<boolean, string> {
        try {
            if (metrics.convergence < 0 || metrics.decisionScore < 0 || metrics.windowConfidence < 0) {
                return { success: false, error: 'ERR_METRICS_NEGATIVE_VALUES_DENIED' };
            }

            this.pushScore(metrics.decisionScore);
            const isQualified = this.activeStrategy.evaluate(metrics);

            return { success: true, value: isQualified };
        } catch (overflowException: unknown) {
            return { 
                success: false, 
                error: `ERR_CONVERGENCE_ENGINE_CRITICAL_FAILURE: ${(overflowException as Error).message}` 
            };
        }
    }
}
