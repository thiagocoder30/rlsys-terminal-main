import { DecisionReplaySnapshot } from './DecisionReplaySnapshot';

export class ReplayHistory {
    private readonly MAX_CAPACITY = 100;
    private history: DecisionReplaySnapshot[] = [];

    public append(snapshot: DecisionReplaySnapshot): void {
        this.history.push(snapshot);
        if (this.history.length > this.MAX_CAPACITY) {
            this.history.shift();
        }
    }

    public getHistory(sessionId: string = 'SESSION-000'): ReadonlyArray<DecisionReplaySnapshot> {
        return Object.freeze(this.history.filter(s => s.sessionId === sessionId || sessionId === 'SESSION-000'));
    }

    public getById(decisionId: string): DecisionReplaySnapshot | null {
        return this.history.find(s => s.decisionId === decisionId) || null;
    }
}
