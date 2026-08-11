export class StrategyDecayCalculator {
    constructor(private readonly lambda: number = 0.85) {
        if (lambda <= 0 || lambda >= 1) {
            this.lambda = 0.85;
        }
    }

    public calculateDecayedWeight(currentWeight: number, newEvidence: number): number {
        const safeCurrent = Math.max(0, currentWeight);
        const safeEvidence = Math.max(0, newEvidence);
        const updated = (safeCurrent * this.lambda) + (safeEvidence * (1 - this.lambda));
        return Math.max(0, updated);
    }

    public getLambda(): number {
        return this.lambda;
    }
}
