"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DealerSignatureEngine = void 0;
const ROULETTE_MIN = 0;
const ROULETTE_MAX = 36;
const EUROPEAN_WHEEL_ORDER = Object.freeze([
    0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13,
    36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20,
    14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
]);
const DEFAULT_POLICY = Object.freeze({
    minSpins: 120,
    maxRecords: 50000,
    signatureRatioThreshold: 0.38,
    minDeviationFromBaseline: 0.13,
    maxEntropyScore: 0.88
});
const TOTAL_SECTORS = 4;
const BASELINE_RATIO = 1 / TOTAL_SECTORS;
/**
 * Detecta assinatura setorial persistente por dealer em dados históricos.
 *
 * A análise é deliberadamente offline/research-only: ela não autoriza aposta,
 * não gera sinal live e não depende de OCR, UI ou infraestrutura externa.
 *
 * Complexidade: O(n) tempo e O(k) espaço, com k limitado a setores fixos.
 */
class DealerSignatureEngine {
    constructor(policy = {}) {
        this.policy = {
            ...DEFAULT_POLICY,
            ...policy
        };
    }
    evaluate(records, dealerId) {
        try {
            const validationError = this.validateInput(records, dealerId);
            if (validationError !== null) {
                return {
                    ok: false,
                    error: validationError
                };
            }
            const normalizedDealerId = dealerId.trim();
            const sectorHits = this.createSectorCounters();
            let totalSpins = 0;
            for (const record of records) {
                if (record.dealerId.trim() !== normalizedDealerId) {
                    continue;
                }
                if (!this.isValidRouletteNumber(record.rouletteNumber)) {
                    return {
                        ok: false,
                        error: 'INVALID_ROULETTE_NUMBER'
                    };
                }
                const sectorId = this.toWheelSector(record.rouletteNumber);
                sectorHits[sectorId] += 1;
                totalSpins += 1;
            }
            if (totalSpins < this.policy.minSpins) {
                return {
                    ok: true,
                    value: this.buildBlockedReport(normalizedDealerId, totalSpins, 'INSUFFICIENT_SAMPLE')
                };
            }
            const sectors = this.buildSectorMetrics(sectorHits, totalSpins);
            const dominant = this.findDominantSector(sectors);
            const entropyScore = this.computeNormalizedEntropy(sectors);
            const deviationFromBaseline = dominant.ratio - BASELINE_RATIO;
            const concentrationScore = this.clamp01((dominant.ratio - BASELINE_RATIO) / (1 - BASELINE_RATIO));
            const blockers = [];
            const warnings = [];
            if (dominant.ratio < this.policy.signatureRatioThreshold) {
                warnings.push('DOMINANT_SECTOR_BELOW_SIGNATURE_THRESHOLD');
            }
            if (deviationFromBaseline < this.policy.minDeviationFromBaseline) {
                warnings.push('DEVIATION_BELOW_BASELINE_THRESHOLD');
            }
            if (entropyScore > this.policy.maxEntropyScore) {
                warnings.push('ENTROPY_TOO_DISTRIBUTED');
            }
            const status = warnings.length === 0
                ? 'SIGNATURE_CANDIDATE'
                : 'INCONCLUSIVE';
            const quality = this.classifyQuality(totalSpins, concentrationScore, entropyScore, warnings.length);
            const reportWithoutChecksum = {
                status,
                dealerId: normalizedDealerId,
                totalSpins,
                dominantSectorId: dominant.sectorId,
                dominantSectorRatio: this.round(dominant.ratio),
                deviationFromBaseline: this.round(deviationFromBaseline),
                entropyScore: this.round(entropyScore),
                concentrationScore: this.round(concentrationScore),
                quality,
                sectors,
                blockers,
                warnings
            };
            return {
                ok: true,
                value: {
                    ...reportWithoutChecksum,
                    checksum: this.checksum(JSON.stringify(reportWithoutChecksum))
                }
            };
        }
        catch {
            return {
                ok: false,
                error: 'DEALER_SIGNATURE_ENGINE_FAILURE'
            };
        }
    }
    validateInput(records, dealerId) {
        if (!Array.isArray(records)) {
            return 'INVALID_RECORDS';
        }
        if (records.length > this.policy.maxRecords) {
            return 'RECORD_BATCH_TOO_LARGE';
        }
        if (typeof dealerId !== 'string' || dealerId.trim().length === 0) {
            return 'INVALID_DEALER_ID';
        }
        for (const record of records) {
            if (typeof record !== 'object' ||
                record === null ||
                typeof record.dealerId !== 'string' ||
                typeof record.rouletteNumber !== 'number') {
                return 'MALFORMED_RECORD';
            }
        }
        return null;
    }
    createSectorCounters() {
        return [0, 0, 0, 0];
    }
    isValidRouletteNumber(value) {
        return (Number.isInteger(value) &&
            value >= ROULETTE_MIN &&
            value <= ROULETTE_MAX);
    }
    toWheelSector(rouletteNumber) {
        const wheelIndex = EUROPEAN_WHEEL_ORDER.indexOf(rouletteNumber);
        const normalizedIndex = wheelIndex >= 0 ? wheelIndex : 0;
        const sectorSize = Math.ceil(EUROPEAN_WHEEL_ORDER.length / TOTAL_SECTORS);
        return Math.min(TOTAL_SECTORS - 1, Math.floor(normalizedIndex / sectorSize));
    }
    buildSectorMetrics(sectorHits, totalSpins) {
        const metrics = [];
        for (let sectorId = 0; sectorId < TOTAL_SECTORS; sectorId += 1) {
            const hits = sectorHits[sectorId] ?? 0;
            metrics.push({
                sectorId,
                hits,
                ratio: this.round(hits / totalSpins)
            });
        }
        return metrics;
    }
    findDominantSector(sectors) {
        let dominant = sectors[0];
        for (const sector of sectors) {
            if (sector.hits > dominant.hits) {
                dominant = sector;
            }
        }
        return dominant;
    }
    computeNormalizedEntropy(sectors) {
        let entropy = 0;
        for (const sector of sectors) {
            if (sector.ratio <= 0) {
                continue;
            }
            entropy -= sector.ratio * Math.log2(sector.ratio);
        }
        return this.clamp01(entropy / Math.log2(TOTAL_SECTORS));
    }
    classifyQuality(totalSpins, concentrationScore, entropyScore, warningsCount) {
        if (warningsCount > 0) {
            return totalSpins >= this.policy.minSpins * 2 ? 'C' : 'D';
        }
        if (totalSpins >= this.policy.minSpins * 3 && concentrationScore >= 0.35 && entropyScore <= 0.75) {
            return 'A';
        }
        if (totalSpins >= this.policy.minSpins * 2) {
            return 'B';
        }
        return 'C';
    }
    buildBlockedReport(dealerId, totalSpins, blocker) {
        const reportWithoutChecksum = {
            status: 'BLOCKED',
            dealerId,
            totalSpins,
            dominantSectorId: -1,
            dominantSectorRatio: 0,
            deviationFromBaseline: 0,
            entropyScore: 1,
            concentrationScore: 0,
            quality: 'D',
            sectors: [],
            blockers: [blocker],
            warnings: []
        };
        return {
            ...reportWithoutChecksum,
            checksum: this.checksum(JSON.stringify(reportWithoutChecksum))
        };
    }
    clamp01(value) {
        return Math.max(0, Math.min(1, value));
    }
    round(value) {
        return Number(value.toFixed(6));
    }
    checksum(input) {
        let hash = 2166136261;
        for (let index = 0; index < input.length; index += 1) {
            hash ^= input.charCodeAt(index);
            hash = Math.imul(hash, 16777619);
        }
        return (hash >>> 0).toString(16).padStart(8, '0');
    }
}
exports.DealerSignatureEngine = DealerSignatureEngine;
