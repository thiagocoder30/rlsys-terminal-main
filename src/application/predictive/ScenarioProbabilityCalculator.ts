export class ScenarioProbabilityCalculator {
    public calculateProbabilities(rawScores: Record<string, number>): Record<string, number> {
        const probabilities: Record<string, number> = {};
        
        let total = 0;
        for (const key of Object.keys(rawScores)) {
            const score = Math.max(0, rawScores[key]); // Ensure non-negative
            probabilities[key] = score;
            total += score;
        }

        if (total === 0) {
            const keys = Object.keys(rawScores);
            if (keys.length === 0) return {};
            const even = 1.0 / keys.length;
            for (const key of keys) {
                probabilities[key] = even;
            }
            return probabilities;
        }

        for (const key of Object.keys(probabilities)) {
            probabilities[key] = probabilities[key] / total;
        }

        return probabilities;
    }
}
