import { DatasetEngine } from '../../domain/research/DatasetEngine';
import { DataIntegrityValidator } from '../../domain/research/DataIntegrityValidator';
import { MonteCarloV2Engine, MonteCarloV2Report } from '../../domain/simulation/MonteCarloV2Engine';

export type MonteCarloV2Status = 'REJECTED' | 'RESEARCH_REVIEW' | 'ROBUSTNESS_CANDIDATE';

export interface MonteCarloV2ResearchReport {
  service: 'MonteCarloV2Service';
  schemaVersion: '2.5.0';
  status: MonteCarloV2Status;
  dataset: {
    checksum?: string;
    totalRecords: number;
    rejectedRows: number;
    integrityStatus: string;
  };
  simulation?: MonteCarloV2Report;
  executiveSummary: {
    operationalGate: 'BLOCKED';
    headline: string;
    robustnessScore: number;
    ruinProbability: number;
    tailRisk: string;
    recommendations: string[];
  };
  generatedAt: string;
}

export class MonteCarloV2Service {
  private readonly datasetEngine = new DatasetEngine();
  private readonly integrityValidator = new DataIntegrityValidator();

  public evaluate(input: unknown): MonteCarloV2ResearchReport {
    const parsed = this.datasetEngine.parse(Array.isArray(input) ? input : String(input ?? ''));
    const normalized = this.datasetEngine.normalize(parsed.records);
    const integrity = this.integrityValidator.validate(normalized.records);

    if (!integrity.valid || normalized.records.length < 120) {
      return {
        service: 'MonteCarloV2Service',
        schemaVersion: '2.5.0',
        status: 'REJECTED',
        dataset: {
          checksum: normalized.checksum,
          totalRecords: normalized.records.length,
          rejectedRows: parsed.rejectedRows.length,
          integrityStatus: integrity.valid ? 'ACCEPTED' : 'REJECTED'
        },
        executiveSummary: {
          operationalGate: 'BLOCKED',
          headline: 'Dataset rejeitado para Monte Carlo v2 por falha de integridade ou amostra insuficiente.',
          robustnessScore: 0,
          ruinProbability: 1,
          tailRisk: 'CRITICAL',
          recommendations: ['Corrigir dataset antes de executar simulação probabilística institucional.', ...integrity.issues.slice(0, 5).map(issue => `${issue.code}: ${issue.message}`)]
        },
        generatedAt: new Date().toISOString()
      };
    }

    const values = normalized.records.map(record => record.value);
    const engine = new MonteCarloV2Engine({ simulations: values.length >= 600 ? 320 : 180, blockSize: Math.max(8, Math.floor(Math.sqrt(values.length))) });
    const simulation = engine.run(values);
    const status = simulation.governance.reviewStatus;

    return {
      service: 'MonteCarloV2Service',
      schemaVersion: '2.5.0',
      status,
      dataset: {
        checksum: normalized.checksum,
        totalRecords: normalized.records.length,
        rejectedRows: parsed.rejectedRows.length,
        integrityStatus: integrity.valid ? 'ACCEPTED' : 'REJECTED'
      },
      simulation,
      executiveSummary: {
        operationalGate: 'BLOCKED',
        headline: this.headline(status, simulation),
        robustnessScore: simulation.summary.robustnessScore,
        ruinProbability: simulation.summary.ruinProbability,
        tailRisk: simulation.summary.tailRisk,
        recommendations: this.recommendations(simulation)
      },
      generatedAt: new Date().toISOString()
    };
  }

  private headline(status: MonteCarloV2Status, simulation: MonteCarloV2Report): string {
    if (status === 'ROBUSTNESS_CANDIDATE') return 'Hipótese candidata à robustez sob bootstrap, ainda sem liberação operacional.';
    if (status === 'REJECTED') return 'Simulação probabilística rejeitou a hipótese sob risco, cauda ou fragilidade.';
    return `Hipótese em revisão: robustez ${simulation.summary.robustnessScore}, ruína ${simulation.summary.ruinProbability}, cauda ${simulation.summary.tailRisk}.`;
  }

  private recommendations(simulation: MonteCarloV2Report): string[] {
    const recommendations = ['Manter gate operacional bloqueado: Monte Carlo v2 valida robustez estatística, não autoriza aposta.'];
    if (simulation.summary.ruinProbability > 0.18) recommendations.push('Reduzir sizing e revisar hipótese: probabilidade de ruína acima do patamar institucional.');
    if (simulation.summary.p95MaxDrawdown > 0.35) recommendations.push('Executar stress adicional: drawdown P95 elevado nas simulações reamostradas.');
    if (simulation.summary.bootstrapConsistency < 0.55) recommendations.push('Investigar dependência da amostra original: consistência bootstrap insuficiente.');
    if (simulation.summary.sequenceDependencyRisk > 0.55) recommendations.push('Aplicar análise de dependência sequencial antes de qualquer hipótese operacional.');
    if (simulation.summary.tailRisk === 'HIGH' || simulation.summary.tailRisk === 'CRITICAL') recommendations.push('Submeter a revisão manual de risco de cauda e cenários extremos.');
    if (simulation.governance.reviewStatus === 'ROBUSTNESS_CANDIDATE') recommendations.push('Executar validação adversarial, bootstrap com blocos alternativos e análise por regime.');
    return [...new Set(recommendations)];
  }
}
