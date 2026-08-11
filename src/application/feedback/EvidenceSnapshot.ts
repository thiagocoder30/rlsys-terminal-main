export interface EvidenceSnapshot {
    readonly timestamp: string;
    readonly sessionId: string;
    readonly evidenceType: string;
    readonly sampleSize: number;
    readonly qualityScore: number;
    readonly stabilityScore: number;
    readonly validationStatus: 'APPROVED' | 'REJECTED';
    readonly reason: string;
    readonly hash: string;
}
