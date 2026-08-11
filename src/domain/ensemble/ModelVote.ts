export interface ModelVote {
    modelId: string;
    suggestedStrategy: string | null;
    confidence: number; // 0 to 100
    weight: number; 
}
