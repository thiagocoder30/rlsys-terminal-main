"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SyntheticSessionGenerator = void 0;
const crypto_1 = __importDefault(require("crypto"));
const Result_1 = require("../shared/Result");
const DEFAULT_POLICY = {
    maxRounds: 20000,
    minRounds: 37,
    noiseRate: 0.03,
    biasStrength: 0.32,
    driftInterval: 80,
    maxNoiseRate: 0.4
};
const EUROPEAN_WHEEL_ORDER = Object.freeze([
    0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
    5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
]);
const SECTOR_NUMBERS = {
    ZERO_SPIEL: Object.freeze([12, 35, 3, 26, 0, 32, 15]),
    VOISINS: Object.freeze([22, 18, 29, 7, 28, 12, 35, 3, 26, 0, 32, 15, 19, 4, 21, 2, 25]),
    TIERS: Object.freeze([27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33]),
    ORPHELINS: Object.freeze([1, 20, 14, 31, 9, 17, 34, 6])
};
/**
 * Generates deterministic synthetic roulette sessions for offline alpha research.
 *
 * The generator is intentionally domain-only: no OCR, UI, filesystem, network or
 * runtime/mobile dependency. Synthetic sessions let research modules test whether
 * they reject fair/noisy worlds and detect controlled physical-like biases.
 *
 * Complexity:
 * - Time: O(n), where n is roundCount.
 * - Space: O(n), bounded by policy.maxRounds.
 */
class SyntheticSessionGenerator {
    generate(request) {
        try {
            const validation = this.validateRequest(request);
            if (validation.length > 0)
                return (0, Result_1.err)(new Result_1.DomainError(validation.join('; '), 'SYNTHETIC_SESSION_INVALID_REQUEST'));
            const policy = this.normalizePolicy(request.policy);
            const blockers = [];
            const warnings = [];
            if (request.roundCount < policy.minRounds)
                blockers.push(`roundCount ${request.roundCount} below minRounds ${policy.minRounds}`);
            if (request.roundCount > policy.maxRounds)
                blockers.push(`roundCount ${request.roundCount} exceeds maxRounds ${policy.maxRounds}`);
            if (policy.noiseRate > policy.maxNoiseRate)
                blockers.push(`noiseRate ${policy.noiseRate} exceeds maxNoiseRate ${policy.maxNoiseRate}`);
            const seed = request.seed ?? this.seedFromSession(request.sessionId);
            const rounds = blockers.length > 0 ? [] : this.generateRounds(request, policy, seed);
            const metrics = this.computeMetrics(rounds, policy);
            if (metrics.roundCount > 0 && metrics.entropyScore < 0.62)
                warnings.push('synthetic session has low entropy and should be reviewed as biased research data');
            if (request.pattern === 'SECTOR_BIAS' || request.pattern === 'CONCENTRATED')
                warnings.push('biased synthetic scenario is research data and must not be treated as live evidence');
            if (request.pattern === 'NOISY_FALSE_ALPHA')
                warnings.push('false-alpha scenario intentionally injects unstable local clusters');
            if (request.pattern === 'DRIFTING')
                warnings.push('drifting scenario intentionally changes preferred sector over time');
            const status = blockers.length > 0 ? 'BLOCKED' : warnings.length > 0 ? 'REVIEW_REQUIRED' : 'GENERATED';
            const reportWithoutChecksum = {
                engineVersion: 'synthetic-session-generator-v1',
                sessionId: request.sessionId.trim(),
                status,
                pattern: request.pattern,
                seed,
                rounds,
                metrics,
                warnings,
                blockers
            };
            return (0, Result_1.ok)({ ...reportWithoutChecksum, checksum: this.checksum(reportWithoutChecksum) });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'unknown synthetic session generator error';
            return (0, Result_1.err)(new Result_1.DomainError(message, 'SYNTHETIC_SESSION_UNEXPECTED_ERROR'));
        }
    }
    validateRequest(request) {
        if (!request || typeof request !== 'object')
            return ['request must be an object'];
        const errors = [];
        if (typeof request.sessionId !== 'string' || request.sessionId.trim().length === 0)
            errors.push('sessionId is required');
        if (!Number.isInteger(request.roundCount) || request.roundCount <= 0)
            errors.push('roundCount must be a positive integer');
        if (!['BALANCED', 'SECTOR_BIAS', 'CONCENTRATED', 'DRIFTING', 'NOISY_FALSE_ALPHA'].includes(request.pattern))
            errors.push('pattern is invalid');
        if (request.seed !== undefined && (!Number.isInteger(request.seed) || request.seed < 0))
            errors.push('seed must be a non-negative integer');
        if (request.dealer !== undefined) {
            if (request.dealer.dealerId !== undefined && (typeof request.dealer.dealerId !== 'string' || request.dealer.dealerId.trim().length === 0))
                errors.push('dealer.dealerId must be a non-empty string');
            if (request.dealer.signatureStrength !== undefined && !this.isRatio(request.dealer.signatureStrength))
                errors.push('dealer.signatureStrength must be between 0 and 1');
            if (request.dealer.preferredSector !== undefined && !this.isSector(request.dealer.preferredSector))
                errors.push('dealer.preferredSector is invalid');
        }
        return errors;
    }
    normalizePolicy(policy) {
        return {
            maxRounds: this.positiveInt(policy?.maxRounds, DEFAULT_POLICY.maxRounds),
            minRounds: this.positiveInt(policy?.minRounds, DEFAULT_POLICY.minRounds),
            noiseRate: this.ratio(policy?.noiseRate, DEFAULT_POLICY.noiseRate),
            biasStrength: this.ratio(policy?.biasStrength, DEFAULT_POLICY.biasStrength),
            driftInterval: this.positiveInt(policy?.driftInterval, DEFAULT_POLICY.driftInterval),
            maxNoiseRate: this.ratio(policy?.maxNoiseRate, DEFAULT_POLICY.maxNoiseRate)
        };
    }
    generateRounds(request, policy, seed) {
        const rounds = [];
        let rng = seed >>> 0;
        const preferred = request.dealer?.preferredSector ?? 'VOISINS';
        const dealerStrength = request.dealer?.signatureStrength ?? 0;
        const effectiveBias = Math.min(0.95, policy.biasStrength + dealerStrength * 0.35);
        for (let index = 0; index < request.roundCount; index += 1) {
            const first = this.next(rng);
            rng = first.state;
            const second = this.next(rng);
            rng = second.state;
            const activeSector = request.pattern === 'DRIFTING' ? this.driftSector(index, policy.driftInterval) : preferred;
            const value = this.pickValue(request.pattern, activeSector, effectiveBias, policy.noiseRate, first.value, second.value, index);
            rounds.push({
                index,
                eventId: `${request.sessionId.trim()}-${index}`,
                value,
                sector: this.sectorOf(value),
                syntheticTag: this.tag(request.pattern, activeSector, value)
            });
        }
        return rounds;
    }
    pickValue(pattern, sector, biasStrength, noiseRate, primaryRandom, secondaryRandom, index) {
        if (primaryRandom < noiseRate)
            return EUROPEAN_WHEEL_ORDER[Math.floor(secondaryRandom * EUROPEAN_WHEEL_ORDER.length)] ?? 0;
        if (pattern === 'BALANCED')
            return EUROPEAN_WHEEL_ORDER[Math.floor(primaryRandom * EUROPEAN_WHEEL_ORDER.length)] ?? 0;
        if (pattern === 'CONCENTRATED') {
            const anchor = SECTOR_NUMBERS[sector][index % Math.min(4, SECTOR_NUMBERS[sector].length)] ?? 0;
            return primaryRandom < 0.78 ? anchor : this.pickFromSector(sector, secondaryRandom);
        }
        if (pattern === 'NOISY_FALSE_ALPHA') {
            const localSector = index % 23 < 7 ? sector : this.driftSector(index, 23);
            return primaryRandom < 0.58 ? this.pickFromSector(localSector, secondaryRandom) : EUROPEAN_WHEEL_ORDER[Math.floor(secondaryRandom * EUROPEAN_WHEEL_ORDER.length)] ?? 0;
        }
        if (pattern === 'SECTOR_BIAS' || pattern === 'DRIFTING') {
            return primaryRandom < biasStrength ? this.pickFromSector(sector, secondaryRandom) : EUROPEAN_WHEEL_ORDER[Math.floor(secondaryRandom * EUROPEAN_WHEEL_ORDER.length)] ?? 0;
        }
        return EUROPEAN_WHEEL_ORDER[Math.floor(primaryRandom * EUROPEAN_WHEEL_ORDER.length)] ?? 0;
    }
    pickFromSector(sector, random) {
        const values = SECTOR_NUMBERS[sector];
        return values[Math.floor(random * values.length)] ?? values[0] ?? 0;
    }
    driftSector(index, interval) {
        const sectors = ['VOISINS', 'TIERS', 'ORPHELINS', 'ZERO_SPIEL'];
        return sectors[Math.floor(index / Math.max(1, interval)) % sectors.length] ?? 'VOISINS';
    }
    tag(pattern, sector, value) {
        if (pattern === 'BALANCED')
            return 'balanced-control';
        if (SECTOR_NUMBERS[sector].includes(value))
            return `${pattern.toLowerCase()}-${sector.toLowerCase()}`;
        return `${pattern.toLowerCase()}-noise`;
    }
    computeMetrics(rounds, policy) {
        const frequencies = new Map();
        const sectorCounts = new Map();
        for (const round of rounds) {
            frequencies.set(round.value, (frequencies.get(round.value) ?? 0) + 1);
            sectorCounts.set(round.sector, (sectorCounts.get(round.sector) ?? 0) + 1);
        }
        let maxNumberFrequency = 0;
        for (const count of frequencies.values())
            maxNumberFrequency = Math.max(maxNumberFrequency, count);
        let dominantSector = 'VOISINS';
        let dominantCount = 0;
        for (const sector of ['VOISINS', 'TIERS', 'ORPHELINS', 'ZERO_SPIEL']) {
            const count = sectorCounts.get(sector) ?? 0;
            if (count > dominantCount) {
                dominantCount = count;
                dominantSector = sector;
            }
        }
        return {
            roundCount: rounds.length,
            uniqueNumbers: frequencies.size,
            zeroCount: frequencies.get(0) ?? 0,
            maxNumberFrequency,
            dominantSector,
            dominantSectorShare: rounds.length === 0 ? 0 : this.round(dominantCount / rounds.length),
            entropyScore: this.round(this.entropy(frequencies, rounds.length)),
            noiseRateApplied: policy.noiseRate,
            biasStrengthApplied: policy.biasStrength,
            driftSegments: rounds.length === 0 ? 0 : Math.ceil(rounds.length / policy.driftInterval)
        };
    }
    entropy(frequencies, total) {
        if (total <= 0)
            return 0;
        let entropy = 0;
        for (const count of frequencies.values()) {
            const p = count / total;
            entropy -= p * Math.log2(p);
        }
        return entropy / Math.log2(37);
    }
    sectorOf(value) {
        for (const sector of ['ZERO_SPIEL', 'VOISINS', 'TIERS', 'ORPHELINS']) {
            if (SECTOR_NUMBERS[sector].includes(value))
                return sector;
        }
        return 'ORPHELINS';
    }
    next(state) {
        const nextState = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return { state: nextState, value: nextState / 0x100000000 };
    }
    seedFromSession(sessionId) {
        const digest = crypto_1.default.createHash('sha256').update(sessionId).digest();
        return digest.readUInt32BE(0);
    }
    positiveInt(value, fallback) {
        return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : fallback;
    }
    ratio(value, fallback) {
        return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1 ? value : fallback;
    }
    isRatio(value) {
        return Number.isFinite(value) && value >= 0 && value <= 1;
    }
    isSector(value) {
        return ['VOISINS', 'TIERS', 'ORPHELINS', 'ZERO_SPIEL'].includes(value);
    }
    round(value) {
        return Math.round(value * 1000000) / 1000000;
    }
    checksum(value) {
        return crypto_1.default.createHash('sha256').update(JSON.stringify(value)).digest('hex');
    }
}
exports.SyntheticSessionGenerator = SyntheticSessionGenerator;
