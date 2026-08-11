export interface RecommendationHistoryItemDTO {
    readonly id: string;
    readonly spinNumber: number;
    readonly drawnNumber: number;
    readonly strategy: string | null;
    readonly stake: number;
    readonly isOpportunity: boolean;
    readonly confidence: number;
    readonly consensus: number;
    readonly vix: number;
    readonly entropy: number;
    readonly explanation: string;
    readonly status: string;
    readonly timestampUtc: string;
}

export class RecommendationHistory {
    private history: RecommendationHistoryItemDTO[] = [];
    private readonly MAX_CAPACITY = 100;

    public add(item: RecommendationHistoryItemDTO): void {
        this.history.push(Object.freeze({ ...item }));
        if (this.history.length > this.MAX_CAPACITY) {
            this.history.shift();
        }
    }

    public getHistory(): RecommendationHistoryItemDTO[] {
        return [...this.history];
    }

    public get count(): number {
        return this.history.length;
    }

    public getLatest(): RecommendationHistoryItemDTO | null {
        if (this.history.length === 0) return null;
        return this.history[this.history.length - 1];
    }

    public clear(): void {
        this.history = [];
    }
}
