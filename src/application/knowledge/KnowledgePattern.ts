export interface KnowledgePattern {
    readonly patternId: string;
    readonly description: string;
    readonly frequency: number;
    readonly confidence: number;
    readonly source: string;
    readonly strategy: string;
    readonly marketRegime: string;
    readonly approvedEvidence: number;
    readonly lastObserved: string;
}
