"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StatisticalResearchService = void 0;
const DatasetEngine_1 = require("../../domain/research/DatasetEngine");
const DataIntegrityValidator_1 = require("../../domain/research/DataIntegrityValidator");
const HypothesisValidator_1 = require("../../domain/statistics/HypothesisValidator");
const StatisticalSignificanceEngine_1 = require("../../domain/statistics/StatisticalSignificanceEngine");
class StatisticalResearchService {
    constructor(datasetEngine = new DatasetEngine_1.DatasetEngine(), integrityValidator = new DataIntegrityValidator_1.DataIntegrityValidator(), significanceEngine = new StatisticalSignificanceEngine_1.StatisticalSignificanceEngine(), hypothesisValidator = new HypothesisValidator_1.HypothesisValidator()) {
        this.datasetEngine = datasetEngine;
        this.integrityValidator = integrityValidator;
        this.significanceEngine = significanceEngine;
        this.hypothesisValidator = hypothesisValidator;
    }
    evaluate(input) {
        const parsed = this.datasetEngine.parse(input);
        const normalized = this.datasetEngine.normalize(parsed.records);
        const integrity = this.integrityValidator.validate(normalized.records);
        const values = normalized.records.map(record => record.value);
        const significance = this.significanceEngine.analyze(values);
        const hypothesis = this.hypothesisValidator.validateUniformRandomness(significance);
        const scientificScore = this.score(integrity.score, significance.evidenceScore, parsed.rejectedRows.length, parsed.records.length);
        const status = this.status(integrity, significance, hypothesis, scientificScore);
        return {
            status,
            integrity,
            significance,
            hypothesis,
            scientificScore,
            recommendations: this.recommend(status, significance, hypothesis)
        };
    }
    score(integrityScore, evidenceScore, rejectedRows, acceptedRows) {
        const rejectionPenalty = acceptedRows + rejectedRows === 0 ? 0.5 : Math.min(0.4, rejectedRows / (acceptedRows + rejectedRows));
        return Number(Math.max(0, Math.min(1, integrityScore * 0.5 + evidenceScore * 0.5 - rejectionPenalty)).toFixed(6));
    }
    status(integrity, significance, hypothesis, scientificScore) {
        if (!integrity.valid)
            return 'REJECTED';
        if (hypothesis.productionGate === 'BLOCK')
            return 'INCONCLUSIVE';
        if (scientificScore >= 0.7 && significance.verdict !== 'NO_EVIDENCE')
            return 'RESEARCH_READY';
        return 'INCONCLUSIVE';
    }
    recommend(status, significance, hypothesis) {
        const recommendations = [...significance.recommendations, ...hypothesis.rationale];
        if (status !== 'RESEARCH_READY')
            recommendations.push('Manter bloqueio operacional: relatório serve para pesquisa, não para execução de stake.');
        if (significance.significantAt95)
            recommendations.push('Executar validação out-of-sample, walk-forward e edge persistence antes de qualquer conclusão.');
        return [...new Set(recommendations)];
    }
}
exports.StatisticalResearchService = StatisticalResearchService;
