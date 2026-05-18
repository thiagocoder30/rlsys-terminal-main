"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResearchDatasetService = void 0;
const DatasetEngine_1 = require("../../domain/research/DatasetEngine");
const DataIntegrityValidator_1 = require("../../domain/research/DataIntegrityValidator");
class ResearchDatasetService {
    constructor(datasetEngine = new DatasetEngine_1.DatasetEngine(), integrityValidator = new DataIntegrityValidator_1.DataIntegrityValidator()) {
        this.datasetEngine = datasetEngine;
        this.integrityValidator = integrityValidator;
    }
    evaluate(input) {
        const parse = this.datasetEngine.parse(input);
        const normalized = this.datasetEngine.normalize(parse.records);
        const integrity = this.integrityValidator.validate(normalized.records);
        const rejectedRatio = parse.records.length + parse.rejectedRows.length === 0
            ? 1
            : parse.rejectedRows.length / (parse.records.length + parse.rejectedRows.length);
        const recommendations = this.recommend(integrity, rejectedRatio);
        const status = !integrity.valid || rejectedRatio > 0.1
            ? 'REJECTED'
            : integrity.score >= 0.85 && rejectedRatio === 0
                ? 'ACCEPTED'
                : 'REVIEW';
        return { status, parse, normalized, integrity, recommendations };
    }
    recommend(integrity, rejectedRatio) {
        const recommendations = [];
        if (integrity.totalRecords < 10000)
            recommendations.push('Aumentar dataset para milhares/dezenas de milhares de spins antes de inferir edge.');
        if (integrity.timestampCoverage < 0.8)
            recommendations.push('Coletar timestamps para análise temporal, regime switching e decay de edge.');
        if (integrity.uniqueValues < 37)
            recommendations.push('Verificar cobertura completa dos números 0-36.');
        if (rejectedRatio > 0)
            recommendations.push(`Sanear linhas rejeitadas antes de backtests institucionais: ${(rejectedRatio * 100).toFixed(2)}%.`);
        if (!integrity.chronological)
            recommendations.push('Ordenar o dataset cronologicamente antes de qualquer walk-forward.');
        if (recommendations.length === 0)
            recommendations.push('Dataset apto para próxima fase de pesquisa estatística controlada.');
        return recommendations;
    }
}
exports.ResearchDatasetService = ResearchDatasetService;
