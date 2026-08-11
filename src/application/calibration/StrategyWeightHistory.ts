import { StrategyWeightSnapshot } from './StrategyWeightSnapshot';

export class StrategyWeightHistory {
    private readonly history: StrategyWeightSnapshot[] = [];
    private readonly MAX_CAPACITY = 100;

    public push(snapshot: StrategyWeightSnapshot): void {
        this.history.push(snapshot);
        if (this.history.length > this.MAX_CAPACITY) {
            this.history.shift();
        }
    }

    public getLatest(sessionId?: string): StrategyWeightSnapshot | null {
        if (this.history.length === 0) return null;
        if (!sessionId) return this.history[this.history.length - 1];
        
        for (let i = this.history.length - 1; i >= 0; i--) {
            if (this.history[i].sessionId === sessionId) {
                return this.history[i];
            }
        }
        return this.history[this.history.length - 1];
    }

    public getAll(sessionId?: string): ReadonlyArray<StrategyWeightSnapshot> {
        if (!sessionId) return this.history;
        return this.history.filter(s => s.sessionId === sessionId || s.sessionId === 'SESSION-000');
    }

    public size(): number {
        return this.history.length;
    }
}
