"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SequentialResearchService = void 0;
const DatasetEngine_1 = require("../../domain/research/DatasetEngine");
const DataIntegrityValidator_1 = require("../../domain/research/DataIntegrityValidator");
const SequentialBiasDetector_1 = require("../../domain/sequential/SequentialBiasDetector");
class SequentialResearchService {
    constructor(datasetEngine = new DatasetEngine_1.DatasetEngine(), integrityValidator = new DataIntegrityValidator_1.DataIntegrityValidator(), sequentialBiasDetector = new SequentialBiasDetector_1.SequentialBiasDetector()) {
        this.datasetEngine = datasetEngine;
        this.integrityValidator = integrityValidator;
        this.sequentialBiasDetector = sequentialBiasDetector;
    }
    evaluate(input) {
        const parsed = this.datasetEngine.parse(input);
        const normalized = this.datasetEngine.normalize(parsed.records);
        const integrity = this.integrityValidator.validate(normalized.records);
        const values = normalized.records.map(record => record.value);
        const sequential = this.sequentialBiasDetector.analyze(values);
        const temporalEvidenceScore = this.score(integrity.score, sequential.sequentialBiasScore, parsed.rejectedRows.length, parsed.records.length);
        const status = this.status(integrity, sequential, temporalEvidenceScore);
        return {
            status,
            integrity,
            sequential,
            temporalEvidenceScore,
            recommendations: this.recommend(status, sequential)
        };
    }
    score(integrityScore, sequentialScore, rejectedRows, acceptedRows) {
        const rejectionPenalty = acceptedRows + rejectedRows === 0 ? 0.5 : Math.min(0.35, rejectedRows / (acceptedRows + rejectedRows));
        return round(Math.max(0, Math.min(1, integrityScore * 0.45 + sequentialScore * 0.55 - rejectionPenalty)));
    }
    status(integrity, sequential, score) {
        if (!integrity.valid)
            return 'REJECTED';
        if (sequential.verdict === 'STRONG_TEMPORAL_EVIDENCE' && score >= 0.72)
            return 'TEMPORAL_RESEARCH_READY';
        if (sequential.verdict === 'MODERATE_TEMPORAL_EVIDENCE' && score >= 0.62)
            return 'TEMPORAL_RESEARCH_READY';
        return 'INCONCLUSIVE';
    }
    recommend(status, sequential) {
        const recommendations = [...sequential.recommendations];
        if (status !== 'TEMPORAL_RESEARCH_READY')
            recommendations.push('Manter bloqueio operacional: evidência temporal ainda não é suficiente para sugerir stake.');
        if (status === 'TEMPORAL_RESEARCH_READY')
            recommendations.push('Executar Sprint 1.4 Edge Persistence antes de qualquer promoção operacional.');
        return [...new Set(recommendations)];
    }
}
exports.SequentialResearchService = SequentialResearchService;
function round(value) {
    if (!Number.isFinite(value))
        return 0;
    return Number(value.toFixed(6));
}
