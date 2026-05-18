"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CapitalExposureService = void 0;
const DatasetEngine_1 = require("../../domain/research/DatasetEngine");
const DataIntegrityValidator_1 = require("../../domain/research/DataIntegrityValidator");
const CapitalExposureSimulator_1 = require("../../domain/risk/CapitalExposureSimulator");
class CapitalExposureService {
    constructor(datasetEngine = new DatasetEngine_1.DatasetEngine(), integrityValidator = new DataIntegrityValidator_1.DataIntegrityValidator(), simulator = new CapitalExposureSimulator_1.CapitalExposureSimulator()) {
        this.datasetEngine = datasetEngine;
        this.integrityValidator = integrityValidator;
        this.simulator = simulator;
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
                recommendations: ['Corrigir integridade do dataset antes de simular exposição de capital.', 'Usar histórico maior e sem valores inválidos para avaliação de risco de ruína.']
            };
        }
        try {
            const analysis = this.simulator.simulate(normalized.records.map(record => record.value));
            return {
                status: analysis.summary.governance.reviewStatus,
                operationalGate: 'BLOCKED',
                generatedAt: new Date().toISOString(),
                datasetChecksum: normalized.checksum,
                analysis,
                blockers: analysis.summary.governance.circuitBreakers,
                recommendations: this.recommendations(analysis)
            };
        }
        catch (error) {
            return {
                status: 'REJECTED',
                operationalGate: 'BLOCKED',
                generatedAt: new Date().toISOString(),
                datasetChecksum: normalized.checksum,
                blockers: ['capital_exposure_simulation_failed', error?.message ?? 'unknown_error'],
                recommendations: ['Revisar tamanho do dataset e parâmetros de capital antes de repetir a simulação.']
            };
        }
    }
    recommendations(analysis) {
        const recommendations = ['Manter gate operacional bloqueado: simulação de capital é evidência de pesquisa, não autorização automática de stake.'];
        if (analysis.summary.worstDrawdown > 0.35)
            recommendations.push('Reduzir stake base e revisar sizing: drawdown de capital acima do patamar prudencial.');
        if (analysis.summary.advancedRiskOfRuin.probability > 0.3)
            recommendations.push('Executar revisão de risco de ruína e stress adversarial antes de qualquer hipótese operacional.');
        if (analysis.summary.maxExposureSaturation > 0.85)
            recommendations.push('Aplicar exposure throttling: saturação de exposição próxima do limite configurado.');
        if (analysis.outcomes.some(outcome => outcome.riskGrade === 'FAIL'))
            recommendations.push('Rejeitar políticas de stake que falham em simulação de capital.');
        if (analysis.summary.governance.reviewStatus === 'CAPITAL_RESILIENT_CANDIDATE')
            recommendations.push('Submeter candidato a bootstrap, validação adversarial e revisão manual de risco.');
        return [...new Set(recommendations)];
    }
}
exports.CapitalExposureService = CapitalExposureService;
