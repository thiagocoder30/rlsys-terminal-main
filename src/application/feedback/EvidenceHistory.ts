import { EvidenceSnapshot } from './EvidenceSnapshot';

export class EvidenceHistory {
    private readonly MAX_CAPACITY = 100;
    private history: EvidenceSnapshot[] = [];

    public append(snapshot: EvidenceSnapshot): void {
        this.history.push(snapshot);
        if (this.history.length > this.MAX_CAPACITY) {
            this.history.shift();
        }
    }

    public getHistory(sessionId: string = 'SESSION-000'): ReadonlyArray<EvidenceSnapshot> {
        return Object.freeze(this.history.filter(s => s.sessionId === sessionId || sessionId === 'SESSION-000'));
    }

    public getLatest(sessionId: string = 'SESSION-000'): EvidenceSnapshot | null {
        const filtered = this.history.filter(s => s.sessionId === sessionId || sessionId === 'SESSION-000');
        return filtered.length > 0 ? filtered[filtered.length - 1] : null;
    }

    public getApprovedCount(sessionId: string = 'SESSION-000'): number {
        return this.history.filter(s => (s.sessionId === sessionId || sessionId === 'SESSION-000') && s.validationStatus === 'APPROVED').length;
    }

    public getRejectedCount(sessionId: string = 'SESSION-000'): number {
        return this.history.filter(s => (s.sessionId === sessionId || sessionId === 'SESSION-000') && s.validationStatus === 'REJECTED').length;
    }
    
    public getAverageQuality(sessionId: string = 'SESSION-000'): number {
        const filtered = this.history.filter(s => s.sessionId === sessionId || sessionId === 'SESSION-000');
        if (filtered.length === 0) return 0;
        const total = filtered.reduce((acc, curr) => acc + curr.qualityScore, 0);
        return Math.round((total / filtered.length) * 100) / 100;
    }
}
