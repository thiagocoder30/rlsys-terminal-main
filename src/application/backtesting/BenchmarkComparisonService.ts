import { DatasetEngine } from '../../domain/research/DatasetEngine';
import { DataIntegrityValidator } from '../../domain/research/DataIntegrityValidator';
import { StrategyBenchmarkEngine, StrategyBenchmarkReport, BenchmarkVerdict } from '../../domain/benchmark/StrategyBenchmarkEngine';

export interface BenchmarkComparisonResearchReport {
  readonly service: 'BenchmarkComparisonService';
  readonly schemaVersion: '2.6.0';
  readonly status: BenchmarkVerdict;
  readonly dataset: {
    readonly checksum?: string;
    readonly totalRecords: number;
    readonly rejectedRows: number;
    readonly integrityStatus: 'ACCEPTED' | 'REJECTED';
  };
  readonly benchmark?: StrategyBenchmarkReport;
  readonly executiveSummary: {
    readonly operationalGate: 'BLOCKED';
    readonly headline: string;
    readonly bestCandidate?: string;
    readonly benchmarkScore: number;
    readonly relativeEdge: number;
    readonly baselineDominanceRisk: number;
    readonly recommendations: string[];
  };
  readonly generatedAt: string;
}

/**
 * Application service that adapts raw datasets into benchmark reports.
 * It keeps parsing/integrity concerns outside the domain benchmark engine and preserves idempotent execution.
 */
export class BenchmarkComparisonService {
  private readonly datasetEngine = new DatasetEngine();
  private readonly integrityValidator = new DataIntegrityValidator();

  public evaluate(input: unknown): BenchmarkComparisonResearchReport {
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
    const engine = new StrategyBenchmarkEngine({
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

  private headline(report: StrategyBenchmarkReport): string {
    if (report.governance.verdict === 'BENCHMARK_CANDIDATE') {
      return 'Estratégia candidata superou benchmarks básicos, ainda com gate operacional bloqueado.';
    }
    if (report.governance.verdict === 'REJECTED') {
      return 'Benchmark rejeitou a hipótese: candidatos não superaram baselines com robustez suficiente.';
    }
    return `Hipótese em revisão: score ${report.comparison.benchmarkScore}, edge relativo ${report.comparison.relativeEdge}.`;
  }

  private recommendations(report: StrategyBenchmarkReport): string[] {
    const recommendations = ['Manter gate operacional bloqueado: benchmarking compara hipóteses, não autoriza entrada real.'];
    if (report.comparison.relativeEdge <= 0) recommendations.push('Não promover estratégia: candidato não supera o melhor baseline.');
    if (report.randomBaseline.beatRateByCandidate < 0.6) recommendations.push('Aumentar dataset ou revisar hipótese: candidato não vence baselines aleatórios o suficiente.');
    if (report.comparison.overfitPenalty > 0.35) recommendations.push('Executar validação adversarial e mais folds: penalidade de overfitting elevada.');
    if (report.comparison.baselineDominanceRisk > 0.55) recommendations.push('Priorizar preservação de banca: risco de dominância por baseline ainda alto.');
    if (report.governance.verdict === 'BENCHMARK_CANDIDATE') recommendations.push('Avançar apenas para validação operacional simulada, com stake zero e auditoria completa.');
    return [...new Set([...recommendations, ...report.governance.blockers])];
  }
}
