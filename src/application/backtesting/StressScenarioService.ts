import { DatasetEngine } from '../../domain/research/DatasetEngine';
import { DataIntegrityValidator } from '../../domain/research/DataIntegrityValidator';
import { StressScenarioAnalysis, StressScenarioAnalyzer } from '../../domain/risk/StressScenarioAnalyzer';

export type StressScenarioStatus = 'REJECTED' | 'RESEARCH_REVIEW' | 'RESILIENT_CANDIDATE';

export interface StressScenarioReport {
  status: StressScenarioStatus;
  operationalGate: 'BLOCKED';
  generatedAt: string;
  datasetChecksum: string;
  analysis?: StressScenarioAnalysis;
  blockers: string[];
  recommendations: string[];
}

export class StressScenarioService {
  constructor(
    private readonly datasetEngine = new DatasetEngine(),
    private readonly integrityValidator = new DataIntegrityValidator(),
    private readonly analyzer = new StressScenarioAnalyzer()
  ) {}

  public evaluate(input: string | unknown[]): StressScenarioReport {
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
    } catch (error: any) {
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

  private recommendations(analysis: StressScenarioAnalysis): string[] {
    const recommendations = ['Manter gate operacional bloqueado: stress test é evidência de pesquisa, não autorização automática de stake.'];
    if (analysis.summary.worstDrawdown > 0.25) recommendations.push('Reduzir stake base ou reforçar filtros: drawdown sob stress acima do alvo prudencial.');
    if (analysis.summary.worstRuinProbabilityProxy > 0.25) recommendations.push('Executar Monte Carlo v2 e risk-of-ruin avançado antes de qualquer revisão operacional.');
    if (analysis.summary.tailRiskScore > 0.35) recommendations.push('Investigar cauda de perdas e clusters adversos com dataset independente.');
    if (analysis.scenarios.some(scenario => scenario.riskGrade === 'FAIL')) recommendations.push('Rejeitar hipótese até eliminar falhas em cenários críticos.');
    if (analysis.summary.approval === 'RESILIENT_CANDIDATE') recommendations.push('Submeter candidato a validação adversarial, bootstrap e revisão manual de risco.');
    return [...new Set(recommendations)];
  }
}
