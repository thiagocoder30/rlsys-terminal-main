"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RouletteStats = void 0;
class RouletteStats {
    static validate(values) {
        if (!Array.isArray(values)) {
            return { ok: false, values: [], errors: ['history must be an array'] };
        }
        const errors = [];
        const parsed = values.map((value, index) => {
            const n = typeof value === 'string' ? Number(value.trim()) : value;
            if (!Number.isInteger(n) || n < 0 || n > 36) {
                errors.push(`invalid roulette number at index ${index}: ${String(value)}`);
                return null;
            }
            return n;
        }).filter((value) => value !== null);
        return { ok: errors.length === 0, values: parsed, errors };
    }
    analyze(history) {
        const counts = this.countNumbers(history);
        const sampleSize = history.length;
        const expected = sampleSize / RouletteStats.EUROPEAN_WHEEL_SIZE;
        const variance = sampleSize * (1 / RouletteStats.EUROPEAN_WHEEL_SIZE) * (36 / RouletteStats.EUROPEAN_WHEEL_SIZE);
        const stdDev = Math.sqrt(variance || 1);
        const numberStats = Array.from({ length: RouletteStats.EUROPEAN_WHEEL_SIZE }, (_, number) => {
            const count = counts.get(number) ?? 0;
            return { number, count, zScore: (count - expected) / stdDev };
        });
        const chiSquare = numberStats.reduce((sum, item) => {
            return sum + Math.pow(item.count - expected, 2) / expected;
        }, 0);
        return {
            sampleSize,
            entropy: this.shannonEntropy(counts, sampleSize),
            maxEntropy: Math.log2(RouletteStats.EUROPEAN_WHEEL_SIZE),
            normalizedEntropy: this.shannonEntropy(counts, sampleSize) / Math.log2(RouletteStats.EUROPEAN_WHEEL_SIZE),
            chiSquare,
            maxAbsNumberZScore: Math.max(...numberStats.map(item => Math.abs(item.zScore))),
            hotNumbers: [...numberStats].sort((a, b) => b.zScore - a.zScore).slice(0, 5),
            coldNumbers: [...numberStats].sort((a, b) => a.zScore - b.zScore).slice(0, 5),
            sectors: this.sectorStats(history),
            lastNumber: history[history.length - 1]
        };
    }
    sectorOf(number) {
        for (const [name, numbers] of Object.entries(RouletteStats.SECTORS)) {
            if (numbers.includes(number))
                return name;
        }
        return 'unknown';
    }
    nextSectorTransition(history) {
        const transitions = new Map();
        if (history.length < 2)
            return transitions;
        const lastSector = this.sectorOf(history[history.length - 1]);
        for (let i = 0; i < history.length - 1; i++) {
            if (this.sectorOf(history[i]) === lastSector) {
                const next = this.sectorOf(history[i + 1]);
                transitions.set(next, (transitions.get(next) ?? 0) + 1);
            }
        }
        return transitions;
    }
    countNumbers(history) {
        return history.reduce((map, number) => {
            map.set(number, (map.get(number) ?? 0) + 1);
            return map;
        }, new Map());
    }
    shannonEntropy(counts, sampleSize) {
        return Array.from(counts.values()).reduce((entropy, count) => {
            const p = count / sampleSize;
            return entropy - p * Math.log2(p);
        }, 0);
    }
    sectorStats(history) {
        const sampleSize = history.length;
        return Object.entries(RouletteStats.SECTORS).map(([name, numbers]) => {
            const hits = history.filter(number => numbers.includes(number)).length;
            const p = numbers.length / RouletteStats.EUROPEAN_WHEEL_SIZE;
            const expectedHits = sampleSize * p;
            const stdDev = Math.sqrt(sampleSize * p * (1 - p) || 1);
            return {
                name,
                hits,
                expectedHits,
                hitRate: hits / sampleSize,
                zScore: (hits - expectedHits) / stdDev,
                numbers
            };
        }).filter(sector => sector.name !== 'zero');
    }
}
exports.RouletteStats = RouletteStats;
RouletteStats.EUROPEAN_WHEEL_SIZE = 37;
RouletteStats.SECTORS = {
    voisins: [22, 18, 29, 7, 28, 12, 35, 3, 26, 0, 32, 15, 19, 4, 21, 2, 25],
    tiers: [27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33],
    orphelins: [1, 20, 14, 31, 9, 17, 34, 6],
    zero: [0]
};
