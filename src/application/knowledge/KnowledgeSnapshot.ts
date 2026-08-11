import { KnowledgePattern } from './KnowledgePattern';

export interface KnowledgeSnapshot {
    readonly snapshotId: string;
    readonly timestamp: string;
    readonly sessionId: string;
    readonly knowledgeVersion: string;
    readonly hash: string;
    readonly patterns: ReadonlyArray<KnowledgePattern>;
    readonly strategySummary: ReadonlyArray<{ strategy: string; performance: number }>;
    readonly regimeSummary: ReadonlyArray<{ regime: string; occurrences: number }>;
    readonly confidenceSummary: number;
    readonly statistics: {
        totalPatterns: number;
        approvedEvidence: number;
        topStrategy: string;
        topRegime: string;
        knowledgeHealth: number;
    };
}
