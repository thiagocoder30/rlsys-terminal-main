export class StrategyPerformanceEvaluator {
    private weights: Map<string, number> = new Map();
    private readonly MIN_THRESHOLD = 0.6; 
    
    // CALIBRAÇÃO ROTA A: Penalidade de 0.5 força o peso de 1.0 a cair para 0.5 instantaneamente,
    // quebrando o circuito e silenciando a estratégia no primeiro erro.
    private readonly DEGRADATION_FACTOR = 0.5; 
    private readonly BONIFICATION_FACTOR = 0.2; 
    private readonly MAX_WEIGHT = 1.2;
    private readonly MIN_WEIGHT = 0.1;

    constructor(strategyIds: string[]) {
        strategyIds.forEach(id => this.weights.set(id, 1.0));
    }

    public getWeight(strategyId: string): number {
        return this.weights.get(strategyId) ?? 1.0;
    }

    public isAllowed(strategyId: string): boolean {
        return this.getWeight(strategyId) >= this.MIN_THRESHOLD;
    }

    public registerLoss(strategyId: string): void {
        const current = this.getWeight(strategyId);
        const next = Math.max(this.MIN_WEIGHT, current - this.DEGRADATION_FACTOR);
        this.weights.set(strategyId, Math.round(next * 10) / 10);
    }

    public registerWin(strategyId: string): void {
        const current = this.getWeight(strategyId);
        const next = Math.min(this.MAX_WEIGHT, current + this.BONIFICATION_FACTOR);
        this.weights.set(strategyId, Math.round(next * 10) / 10);
    }

    public getAllWeights(): Record<string, number> {
        const record: Record<string, number> = {};
        this.weights.forEach((val, key) => { record[key] = val; });
        return record;
    }

    // Injeção de estado vindo do cofre criptográfico
    public setWeights(record: Record<string, number>): void {
        Object.entries(record).forEach(([key, val]) => {
            this.weights.set(key, val);
        });
    }
}
