export interface FeedbackDecision {
    readonly decisionId: string;
    readonly sessionId: string;
    readonly evidenceType: string; // 'SHADOW_PERFORMANCE', 'SESSION_PERFORMANCE', 'REGIME_SHIFT', etc.
    readonly status: 'APPROVED' | 'REJECTED';
    readonly reason: string;
    readonly timestamp: string;
    readonly hash: string;
}
