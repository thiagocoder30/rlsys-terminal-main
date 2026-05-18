"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InstitutionalBacktestService = void 0;
const DatasetEngine_1 = require("../../domain/research/DatasetEngine");
const DataIntegrityValidator_1 = require("../../domain/research/DataIntegrityValidator");
const InstitutionalBacktestEngine_1 = require("../../domain/backtesting/InstitutionalBacktestEngine");
class InstitutionalBacktestService {
    constructor(datasetEngine = new DatasetEngine_1.DatasetEngine(), integrityValidator = new DataIntegrityValidator_1.DataIntegrityValidator(), backtestEngine = new InstitutionalBacktestEngine_1.InstitutionalBacktestEngine()) {
        this.datasetEngine = datasetEngine;
        this.integrityValidator = integrityValidator;
        this.backtestEngine = backtestEngine;
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
                recommendations: ['Corrigir dataset antes de executar backtest institucional.', 'Usar amostras maiores, sem valores inválidos e com ordenação temporal consistente.']
            };
        }
        const result = this.backtestEngine.run(normalized.records.map(record => record.value));
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
        const recommendations = ['Manter gate operacional bloqueado: backtest é evidência de pesquisa, não autorização automática de stake.'];
        if (result.summary.trades < 100)
            recommendations.push('Aumentar amostra para obter mais trades out-of-sample.');
        if (!result.baseline.strategyOutperformed)
            recommendations.push('Rejeitar hipótese até superar baseline independente.');
        if (result.summary.maxDrawdown > 0.2)
            recommendations.push('Reduzir stake ou reforçar filtro de risco: drawdown acima do alvo institucional.');
        if (result.stress.some(item => item.riskFlag !== 'PASS'))
            recommendations.push('Investigar falhas em cenários de stress antes de qualquer revisão operacional.');
        if (result.summary.approval === 'CANDIDATE')
            recommendations.push('Submeter a validação adversarial, dados independentes e revisão manual de risco.');
        return [...new Set(recommendations)];
    }
}
exports.InstitutionalBacktestService = InstitutionalBacktestService;
