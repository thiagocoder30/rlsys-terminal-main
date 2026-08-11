export interface SessionTimelineEntryDTO {
    readonly spinNumber: number;
    readonly drawnNumber: number;
    readonly timestampUtc: string;
    readonly operationalVix: number;
    readonly entropy: number;
    readonly consensus: number;
    readonly suggestedStrategy: string | null;
    readonly stake: number;
    readonly status: string;
    readonly processingTimeMs: number;
}

export class SessionTimeline {
    private entries: SessionTimelineEntryDTO[] = [];

    public addEntry(entry: SessionTimelineEntryDTO): void {
        this.entries.push(Object.freeze({ ...entry }));
    }

    public getEntries(): SessionTimelineEntryDTO[] {
        return [...this.entries];
    }

    public getLatest(): SessionTimelineEntryDTO | null {
        if (this.entries.length === 0) return null;
        return this.entries[this.entries.length - 1];
    }

    public get count(): number {
        return this.entries.length;
    }

    public clear(): void {
        this.entries = [];
    }
}
