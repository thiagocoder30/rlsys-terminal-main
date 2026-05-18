"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatasetRegistryEngine = void 0;
const crypto_1 = __importDefault(require("crypto"));
const Result_1 = require("../shared/Result");
const DEFAULT_POLICY = {
    maxDatasets: 64,
    maxTagsPerDataset: 16,
    maxSampleValues: 2000,
    minCompletenessScore: 0.92,
    minReliabilityScore: 0.82,
    blockSynthetic: false
};
const VALID_SOURCE_TYPES = new Set(['MANUAL', 'OCR', 'CSV', 'REPLAY', 'SYNTHETIC']);
const TAG_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9:_-]{0,47}$/;
/**
 * Registers and labels research datasets with deterministic checksums.
 *
 * This engine is intentionally domain-only: it does not persist records and it
 * does not read files. Infrastructure can store the returned records in JSONL,
 * SQLite, Git or a remote registry without changing the core rules.
 *
 * Complexity:
 * - Time: O(d + v + t), where d is dataset count, v is sampled roulette values
 *   and t is total tags.
 * - Space: O(d + t). Sets are bounded by the number of registered datasets.
 */
class DatasetRegistryEngine {
    register(request) {
        try {
            const validation = this.validateRequest(request);
            if (validation.length > 0)
                return (0, Result_1.err)(new Result_1.DomainError(validation.join('; '), 'DATASET_REGISTRY_INVALID_REQUEST'));
            const policy = this.normalizePolicy(request.policy);
            if (request.datasets.length > policy.maxDatasets) {
                return (0, Result_1.err)(new Result_1.DomainError(`dataset count ${request.datasets.length} exceeds maxDatasets ${policy.maxDatasets}`, 'DATASET_REGISTRY_TOO_LARGE'));
            }
            const records = [];
            const blockers = [];
            const warnings = [];
            for (const dataset of request.datasets) {
                const record = this.record(dataset, policy);
                records.push(record);
                blockers.push(...record.blockers.map((blocker) => `dataset ${record.datasetId}: ${blocker}`));
                warnings.push(...record.warnings.map((warning) => `dataset ${record.datasetId}: ${warning}`));
            }
            const summary = this.summary(records);
            const status = blockers.length > 0 ? 'BLOCKED' : summary.reviewDatasets > 0 ? 'REVIEW_REQUIRED' : 'ACCEPTED';
            const reportWithoutChecksum = {
                engineVersion: 'dataset-registry-engine-v1',
                registryId: request.registryId.trim(),
                status,
                records,
                summary,
                blockers,
                warnings
            };
            return (0, Result_1.ok)({ ...reportWithoutChecksum, checksum: this.checksum(reportWithoutChecksum) });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'unknown dataset registry error';
            return (0, Result_1.err)(new Result_1.DomainError(message, 'DATASET_REGISTRY_UNEXPECTED_ERROR'));
        }
    }
    validateRequest(request) {
        const errors = [];
        if (!request || typeof request !== 'object')
            return ['request must be an object'];
        if (typeof request.registryId !== 'string' || request.registryId.trim().length === 0)
            errors.push('registryId is required');
        if (!Array.isArray(request.datasets) || request.datasets.length === 0)
            errors.push('datasets must be a non-empty array');
        const seen = new Set();
        for (let index = 0; index < (request.datasets?.length ?? 0); index += 1) {
            const dataset = request.datasets[index];
            if (!dataset || typeof dataset !== 'object') {
                errors.push(`dataset[${index}] must be an object`);
                continue;
            }
            if (typeof dataset.datasetId !== 'string' || dataset.datasetId.trim().length === 0)
                errors.push(`dataset[${index}].datasetId is required`);
            if (typeof dataset.datasetId === 'string') {
                const id = dataset.datasetId.trim();
                if (seen.has(id))
                    errors.push(`dataset[${index}].datasetId must be unique`);
                seen.add(id);
            }
            if (!VALID_SOURCE_TYPES.has(dataset.sourceType))
                errors.push(`dataset[${index}].sourceType is invalid`);
            if (!Number.isFinite(dataset.roundCount) || dataset.roundCount < 1)
                errors.push(`dataset[${index}].roundCount must be positive`);
            if (dataset.sampleValues !== undefined && !Array.isArray(dataset.sampleValues))
                errors.push(`dataset[${index}].sampleValues must be an array`);
            if (dataset.tags !== undefined && !Array.isArray(dataset.tags))
                errors.push(`dataset[${index}].tags must be an array`);
            this.validateScore(dataset.reliabilityScore, `dataset[${index}].reliabilityScore`, errors);
            this.validateScore(dataset.completenessScore, `dataset[${index}].completenessScore`, errors);
        }
        if (request.policy !== undefined)
            this.validatePolicy(request.policy, errors);
        return errors;
    }
    validatePolicy(policy, errors) {
        if (policy.maxDatasets !== undefined && (!Number.isFinite(policy.maxDatasets) || policy.maxDatasets < 1))
            errors.push('policy.maxDatasets must be positive');
        if (policy.maxTagsPerDataset !== undefined && (!Number.isFinite(policy.maxTagsPerDataset) || policy.maxTagsPerDataset < 1))
            errors.push('policy.maxTagsPerDataset must be positive');
        if (policy.maxSampleValues !== undefined && (!Number.isFinite(policy.maxSampleValues) || policy.maxSampleValues < 1))
            errors.push('policy.maxSampleValues must be positive');
        this.validateScore(policy.minCompletenessScore, 'policy.minCompletenessScore', errors);
        this.validateScore(policy.minReliabilityScore, 'policy.minReliabilityScore', errors);
    }
    validateScore(value, label, errors) {
        if (value === undefined)
            return;
        if (!Number.isFinite(value) || value < 0 || value > 1)
            errors.push(`${label} must be between 0 and 1`);
    }
    normalizePolicy(policy) {
        return {
            maxDatasets: Math.trunc(policy?.maxDatasets ?? DEFAULT_POLICY.maxDatasets),
            maxTagsPerDataset: Math.trunc(policy?.maxTagsPerDataset ?? DEFAULT_POLICY.maxTagsPerDataset),
            maxSampleValues: Math.trunc(policy?.maxSampleValues ?? DEFAULT_POLICY.maxSampleValues),
            minCompletenessScore: policy?.minCompletenessScore ?? DEFAULT_POLICY.minCompletenessScore,
            minReliabilityScore: policy?.minReliabilityScore ?? DEFAULT_POLICY.minReliabilityScore,
            blockSynthetic: policy?.blockSynthetic ?? DEFAULT_POLICY.blockSynthetic
        };
    }
    record(dataset, policy) {
        const reliabilityScore = this.round6(dataset.reliabilityScore ?? this.defaultReliability(dataset.sourceType));
        const completenessScore = this.round6(dataset.completenessScore ?? this.defaultCompleteness(dataset.roundCount));
        const blockers = [];
        const warnings = [];
        const tags = this.normalizeTags(dataset.tags ?? [], policy.maxTagsPerDataset, blockers, warnings);
        this.inspectSampleValues(dataset, policy, blockers, warnings);
        if (dataset.sourceType === 'SYNTHETIC' && policy.blockSynthetic)
            blockers.push('synthetic datasets are blocked by policy');
        if (reliabilityScore < policy.minReliabilityScore)
            warnings.push(`reliability ${reliabilityScore.toFixed(3)} below policy ${policy.minReliabilityScore.toFixed(3)}`);
        if (completenessScore < policy.minCompletenessScore)
            warnings.push(`completeness ${completenessScore.toFixed(3)} below policy ${policy.minCompletenessScore.toFixed(3)}`);
        if (dataset.roundCount < 100)
            warnings.push('dataset has fewer than 100 rounds and should not be used for warmup-grade validation');
        if (dataset.sourceType === 'OCR' && dataset.reliabilityScore === undefined)
            warnings.push('OCR dataset registered without explicit reliability score');
        const qualityGrade = this.grade(reliabilityScore, completenessScore, blockers.length, warnings.length);
        const requiresReview = blockers.length > 0 || warnings.length > 0 || qualityGrade === 'C' || qualityGrade === 'D';
        const normalizedRecordWithoutChecksums = {
            datasetId: dataset.datasetId.trim(),
            sourceType: dataset.sourceType,
            provider: this.optionalTrim(dataset.provider),
            tableId: this.optionalTrim(dataset.tableId),
            dealerId: this.optionalTrim(dataset.dealerId),
            capturedAt: this.optionalTrim(dataset.capturedAt),
            roundCount: Math.trunc(dataset.roundCount),
            tags,
            regimeLabel: this.optionalTrim(dataset.regimeLabel),
            reliabilityScore,
            completenessScore,
            qualityGrade,
            requiresReview,
            blockers,
            warnings
        };
        return {
            ...normalizedRecordWithoutChecksums,
            contentChecksum: this.checksum({ datasetId: normalizedRecordWithoutChecksums.datasetId, sampleValues: dataset.sampleValues ?? [], roundCount: normalizedRecordWithoutChecksums.roundCount }),
            metadataChecksum: this.checksum(normalizedRecordWithoutChecksums)
        };
    }
    normalizeTags(tags, maxTags, blockers, warnings) {
        if (tags.length > maxTags)
            blockers.push(`tag count ${tags.length} exceeds maxTagsPerDataset ${maxTags}`);
        const normalized = [];
        const seen = new Set();
        for (const rawTag of tags) {
            if (typeof rawTag !== 'string') {
                blockers.push('tags must contain only strings');
                continue;
            }
            const tag = rawTag.trim().toLowerCase();
            if (tag.length === 0)
                continue;
            if (!TAG_PATTERN.test(tag)) {
                warnings.push(`tag '${tag.slice(0, 24)}' was ignored because it is not registry-safe`);
                continue;
            }
            if (!seen.has(tag)) {
                seen.add(tag);
                normalized.push(tag);
            }
        }
        normalized.sort();
        return normalized;
    }
    inspectSampleValues(dataset, policy, blockers, warnings) {
        const values = dataset.sampleValues;
        if (values === undefined) {
            warnings.push('dataset registered without sample values; content checksum will only cover metadata count');
            return;
        }
        if (values.length > policy.maxSampleValues) {
            blockers.push(`sampleValues length ${values.length} exceeds maxSampleValues ${policy.maxSampleValues}`);
            return;
        }
        if (values.length !== Math.trunc(dataset.roundCount))
            warnings.push('sampleValues length differs from roundCount');
        for (let index = 0; index < values.length; index += 1) {
            const value = values[index];
            if (!Number.isInteger(value) || value < 0 || value > 36) {
                blockers.push(`sampleValues[${index}] must be an integer roulette value between 0 and 36`);
                return;
            }
        }
    }
    defaultReliability(sourceType) {
        if (sourceType === 'MANUAL' || sourceType === 'CSV' || sourceType === 'REPLAY')
            return 0.96;
        if (sourceType === 'SYNTHETIC')
            return 1;
        return 0.72;
    }
    defaultCompleteness(roundCount) {
        return this.clamp(roundCount / 100);
    }
    grade(reliability, completeness, blockerCount, warningCount) {
        if (blockerCount > 0 || reliability < 0.65 || completeness < 0.65)
            return 'D';
        if (reliability >= 0.95 && completeness >= 0.98 && warningCount === 0)
            return 'A';
        if (reliability >= 0.85 && completeness >= 0.9)
            return 'B';
        return 'C';
    }
    summary(records) {
        const providers = new Set();
        const tables = new Set();
        const dealers = new Set();
        const tags = new Set();
        let acceptedDatasets = 0;
        let reviewDatasets = 0;
        let blockedDatasets = 0;
        let totalRounds = 0;
        let reliabilitySum = 0;
        let completenessSum = 0;
        for (const record of records) {
            if (record.blockers.length > 0)
                blockedDatasets += 1;
            else if (record.requiresReview)
                reviewDatasets += 1;
            else
                acceptedDatasets += 1;
            totalRounds += record.roundCount;
            reliabilitySum += record.reliabilityScore;
            completenessSum += record.completenessScore;
            if (record.provider)
                providers.add(record.provider);
            if (record.tableId)
                tables.add(record.tableId);
            if (record.dealerId)
                dealers.add(record.dealerId);
            for (const tag of record.tags)
                tags.add(tag);
        }
        const count = Math.max(1, records.length);
        return {
            totalDatasets: records.length,
            acceptedDatasets,
            reviewDatasets,
            blockedDatasets,
            totalRounds,
            averageReliabilityScore: this.round6(reliabilitySum / count),
            averageCompletenessScore: this.round6(completenessSum / count),
            uniqueProviders: providers.size,
            uniqueTables: tables.size,
            uniqueDealers: dealers.size,
            tagCount: tags.size
        };
    }
    optionalTrim(value) {
        if (typeof value !== 'string')
            return undefined;
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : undefined;
    }
    clamp(value) {
        if (value < 0)
            return 0;
        if (value > 1)
            return 1;
        return value;
    }
    round6(value) {
        return Math.round(value * 1000000) / 1000000;
    }
    checksum(payload) {
        return crypto_1.default.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
    }
}
exports.DatasetRegistryEngine = DatasetRegistryEngine;
