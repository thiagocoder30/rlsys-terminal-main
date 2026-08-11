export class ConfidenceWeightedVote {
    public static weight(baseWeight: number, adaptiveConfidence: number): number {
        return baseWeight * (adaptiveConfidence / 100);
    }
}
