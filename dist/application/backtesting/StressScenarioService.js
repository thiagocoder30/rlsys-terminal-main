"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StressScenarioService = void 0;
const DatasetEngine_1 = require("../../domain/research/DatasetEngine");
const DataIntegrityValidator_1 = require("../../domain/research/DataIntegrityValidator");
const StressScenarioAnalyzer_1 = require("../../domain/risk/StressScenarioAnalyzer");
class StressScenarioService {
    constructor(datasetEngine = new DatasetEngine_1.DatasetEngine(), integrityValidator = new DataIntegrityValidator_1.DataIntegrityValidator(), analyzer = new StressScenarioAnalyzer_1.StressScenarioAnalyzer()) {
        this.datasetEngine = datasetEngine;
        this.integrityValidator = integrityValidator;
        this.analyzer = analyzer;
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
                recommendations: ['Corrigir integridade do dataset antes de executar stress institucional.', 'Usar histórico maior, ordenado e sem valores inválidos.']
            };
        }
        try {
            const analysis = this.analyzer.analyze(normalized.records.map(record => record.value));
            return {
                status: analysis.summary.approval,
                operationalGate: 'BLOCKED',
                generatedAt: new Date().toISOString(),
                datasetChecksum: normalized.checksum,
                analysis,
                blockers: analysis.summary.blockers,
                recommendations: this.recommendations(analysis)
            };
        }
        catch (error) {
            return {
                status: 'REJECTED',
                operationalGate: 'BLOCKED',
                generatedAt: new Date().toISOString(),
                datasetChecksum: normalized.checksum,
                blockers: ['stress_analysis_failed', error?.message ?? 'unknown_error'],
                recommendations: ['Revisar tamanho e qualidade da amostra antes de repetir o stress test.']
            };
        }
    }
    recommendations(analysis) {
        const recommendations = ['Manter gate operacional bloqueado: stress test é evidência de pesquisa, não autorização automática de stake.'];
        if (analysis.summary.worstDrawdown > 0.25)
            recommendations.push('Reduzir stake base ou reforçar filtros: drawdown sob stress acima do alvo prudencial.');
        if (analysis.summary.worstRuinProbabilityProxy > 0.25)
            recommendations.push('Executar Monte Carlo v2 e risk-of-ruin avançado antes de qualquer revisão operacional.');
        if (analysis.summary.tailRiskScore > 0.35)
            recommendations.push('Investigar cauda de perdas e clusters adversos com dataset independente.');
        if (analysis.scenarios.some(scenario => scenario.riskGrade === 'FAIL'))
            recommendations.push('Rejeitar hipótese até eliminar falhas em cenários críticos.');
        if (analysis.summary.approval === 'RESILIENT_CANDIDATE')
            recommendations.push('Submeter candidato a validação adversarial, bootstrap e revisão manual de risco.');
        return [...new Set(recommendations)];
    }
}
exports.StressScenarioService = StressScenarioService;
