export class RiskWeightedVote {
    public static weight(baseWeight: number, vix: number, drawdown: number): number {
        let weight = baseWeight;
        if (vix > 80) weight *= 0.5;
        if (drawdown > 10) weight *= 0.8;
        return weight;
    }
}
