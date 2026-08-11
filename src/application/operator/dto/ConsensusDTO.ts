export interface ConsensusDTO {
    level: string;
    agreementScore: number;
    conflictLevel: string;
    dominantStrategy: string | null;
    confidenceScore: number;
    votes: {
        modelId: string;
        suggestedStrategy: string | null;
        confidence: number;
        weight: number;
    }[];
}
