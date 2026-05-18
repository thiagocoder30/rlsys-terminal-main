"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdvancedWalkForwardService = void 0;
const AdvancedWalkForwardValidator_1 = require("../../domain/backtesting/AdvancedWalkForwardValidator");
const DatasetEngine_1 = require("../../domain/research/DatasetEngine");
const DataIntegrityValidator_1 = require("../../domain/research/DataIntegrityValidator");
class AdvancedWalkForwardService {
    constructor(datasetEngine = new DatasetEngine_1.DatasetEngine(), integrityValidator = new DataIntegrityValidator_1.DataIntegrityValidator(), validator = new AdvancedWalkForwardValidator_1.AdvancedWalkForwardValidator()) {
        this.datasetEngine = datasetEngine;
        this.integrityValidator = integrityValidator;
        this.validator = validator;
    }
    evaluate(input) {
        const parsed = this.datasetEngine.parse(input);
        const normalized = this.datasetEngine.normalize(parsed.records);
        const integrity = this.integrityValidator.validate(normalized.records);
        if (!integrity.valid) {
            return {
                status: 'REJECTED',
                operationalGate: 'BLOCKED',
                generatedAt: new Date().toISOString(),
                datasetChecksum: normalized.checksum,
                blockers: ['dataset_integrity_failed', ...integrity.issues.map(issue => issue.code).slice(0, 8)],
                recommendations: ['Corrigir integridade do dataset antes de validação walk-forward avançada.']
            };
        }
        const result = this.validator.evaluate(normalized.records.map(record => record.value));
        return {
            status: result.summary.approval,
            operationalGate: 'BLOCKED',
            generatedAt: new Date().toISOString(),
            datasetChecksum: normalized.checksum,
            result,
            blockers: result.summary.blockers,
            recommendations: this.recommendations(result)
        };
    }
    recommendations(result) {
        const recommendations = ['Manter gate operacional bloqueado: walk-forward é validação de pesquisa, não autorização automática de stake.'];
        if (result.summary.folds < result.options.minFolds)
            recommendations.push('Aumentar dataset para gerar mais folds independentes.');
        if (result.summary.meanValidationEdge <= 0)
            recommendations.push('Rejeitar hipótese até existir edge positivo fora da amostra.');
        if (result.summary.overfitRiskScore > 0.45)
            recommendations.push('Reduzir complexidade da hipótese: risco de overfitting elevado.');
        if (result.summary.outOfSampleConsistency < 0.55)
            recommendations.push('Investigar instabilidade entre treino e validação.');
        if (result.summary.approval === 'CANDIDATE')
            recommendations.push('Submeter hipótese a dataset independente, stress adversarial e revisão manual de risco.');
        return [...new Set(recommendations)];
    }
}
exports.AdvancedWalkForwardService = AdvancedWalkForwardService;
