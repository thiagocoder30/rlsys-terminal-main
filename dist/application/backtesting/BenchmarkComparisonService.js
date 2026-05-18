"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BenchmarkComparisonService = void 0;
const DatasetEngine_1 = require("../../domain/research/DatasetEngine");
const DataIntegrityValidator_1 = require("../../domain/research/DataIntegrityValidator");
const StrategyBenchmarkEngine_1 = require("../../domain/benchmark/StrategyBenchmarkEngine");
/**
 * Application service that adapts raw datasets into benchmark reports.
 * It keeps parsing/integrity concerns outside the domain benchmark engine and preserves idempotent execution.
 */
class BenchmarkComparisonService {
    constructor() {
        this.datasetEngine = new DatasetEngine_1.DatasetEngine();
        this.integrityValidator = new DataIntegrityValidator_1.DataIntegrityValidator();
    }
    evaluate(input) {
        const parsed = this.datasetEngine.parse(Array.isArray(input) ? input : String(input ?? ''));
        const normalized = this.datasetEngine.normalize(parsed.records);
        const integrity = this.integrityValidator.validate(normalized.records);
        if (!integrity.valid || normalized.records.length < 120) {
            return {
                service: 'BenchmarkComparisonService',
                schemaVersion: '2.6.0',
                status: 'REJECTED',
                dataset: {
                    checksum: normalized.checksum,
                    totalRecords: normalized.records.length,
                    rejectedRows: parsed.rejectedRows.length,
                    integrityStatus: integrity.valid ? 'ACCEPTED' : 'REJECTED'
                },
                executiveSummary: {
                    operationalGate: 'BLOCKED',
                    headline: 'Dataset rejeitado para benchmarking por falha de integridade ou amostra insuficiente.',
                    benchmarkScore: 0,
                    relativeEdge: 0,
                    baselineDominanceRisk: 1,
                    recommendations: [
                        'Corrigir dataset e executar novamente antes de comparar estratégias.',
                        ...integrity.issues.slice(0, 5).map(issue => `${issue.code}: ${issue.message}`)
                    ]
                },
                generatedAt: new Date().toISOString()
            };
        }
        const values = normalized.records.map(record => record.value);
        const engine = new StrategyBenchmarkEngine_1.StrategyBenchmarkEngine({
            randomRuns: values.length >= 600 ? 160 : 96,
            windowSize: Math.max(48, Math.min(120, Math.floor(values.length * 0.18)))
        });
        const benchmark = engine.run(values);
        return {
            service: 'BenchmarkComparisonService',
            schemaVersion: '2.6.0',
            status: benchmark.governance.verdict,
            dataset: {
                checksum: normalized.checksum,
                totalRecords: normalized.records.length,
                rejectedRows: parsed.rejectedRows.length,
                integrityStatus: 'ACCEPTED'
            },
            benchmark,
            executiveSummary: {
                operationalGate: 'BLOCKED',
                headline: this.headline(benchmark),
                bestCandidate: benchmark.comparison.bestCandidate?.strategyId,
                benchmarkScore: benchmark.comparison.benchmarkScore,
                relativeEdge: benchmark.comparison.relativeEdge,
                baselineDominanceRisk: benchmark.comparison.baselineDominanceRisk,
                recommendations: this.recommendations(benchmark)
            },
            generatedAt: new Date().toISOString()
        };
    }
    headline(report) {
        if (report.governance.verdict === 'BENCHMARK_CANDIDATE') {
            return 'Estratégia candidata superou benchmarks básicos, ainda com gate operacional bloqueado.';
        }
        if (report.governance.verdict === 'REJECTED') {
            return 'Benchmark rejeitou a hipótese: candidatos não superaram baselines com robustez suficiente.';
        }
        return `Hipótese em revisão: score ${report.comparison.benchmarkScore}, edge relativo ${report.comparison.relativeEdge}.`;
    }
    recommendations(report) {
        const recommendations = ['Manter gate operacional bloqueado: benchmarking compara hipóteses, não autoriza entrada real.'];
        if (report.comparison.relativeEdge <= 0)
            recommendations.push('Não promover estratégia: candidato não supera o melhor baseline.');
        if (report.randomBaseline.beatRateByCandidate < 0.6)
            recommendations.push('Aumentar dataset ou revisar hipótese: candidato não vence baselines aleatórios o suficiente.');
        if (report.comparison.overfitPenalty > 0.35)
            recommendations.push('Executar validação adversarial e mais folds: penalidade de overfitting elevada.');
        if (report.comparison.baselineDominanceRisk > 0.55)
            recommendations.push('Priorizar preservação de banca: risco de dominância por baseline ainda alto.');
        if (report.governance.verdict === 'BENCHMARK_CANDIDATE')
            recommendations.push('Avançar apenas para validação operacional simulada, com stake zero e auditoria completa.');
        return [...new Set([...recommendations, ...report.governance.blockers])];
    }
}
exports.BenchmarkComparisonService = BenchmarkComparisonService;
