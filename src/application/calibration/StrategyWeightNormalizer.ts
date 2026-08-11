export class StrategyWeightNormalizer {
    public normalizeToUnit(weights: Record<string, number>): Record<string, number> {
        const keys = Object.keys(weights);
        if (keys.length === 0) return {};

        const clamped: Record<string, number> = {};
        let sum = 0;

        for (const key of keys) {
            const val = Math.max(0, weights[key] || 0);
            clamped[key] = val;
            sum += val;
        }

        const normalized: Record<string, number> = {};

        if (sum === 0) {
            const equalShare = Math.round((1 / keys.length) * 10000) / 10000;
            for (const key of keys) {
                normalized[key] = equalShare;
            }
            return normalized;
        }

        for (const key of keys) {
            normalized[key] = Math.round((clamped[key] / sum) * 10000) / 10000;
        }

        return normalized;
    }

    public scaleToHundred(weights: Record<string, number>): Record<string, number> {
        const unit = this.normalizeToUnit(weights);
        const scaled: Record<string, number> = {};
        for (const [k, v] of Object.entries(unit)) {
            scaled[k] = Math.round(v * 100 * 100) / 100;
        }
        return scaled;
    }
}
