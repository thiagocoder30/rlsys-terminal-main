import { DatasetEngine } from '../../domain/research/DatasetEngine';
import { DataIntegrityValidator } from '../../domain/research/DataIntegrityValidator';
import { CapitalExposureAnalysis, CapitalExposureSimulator } from '../../domain/risk/CapitalExposureSimulator';

export type CapitalExposureStatus = 'REJECTED' | 'RESEARCH_REVIEW' | 'CAPITAL_RESILIENT_CANDIDATE';

export interface CapitalExposureReport {
  status: CapitalExposureStatus;
  operationalGate: 'BLOCKED';
  generatedAt: string;
  datasetChecksum: string;
  analysis?: CapitalExposureAnalysis;
  blockers: string[];
  recommendations: string[];
}

export class CapitalExposureService {
  constructor(
    private readonly datasetEngine = new DatasetEngine(),
    private readonly integrityValidator = new DataIntegrityValidator(),
    private readonly simulator = new CapitalExposureSimulator()
  ) {}

  public evaluate(input: string | unknown[]): CapitalExposureReport {
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
    } catch (error: any) {
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

  private recommendations(analysis: CapitalExposureAnalysis): string[] {
    const recommendations = ['Manter gate operacional bloqueado: simulação de capital é evidência de pesquisa, não autorização automática de stake.'];
    if (analysis.summary.worstDrawdown > 0.35) recommendations.push('Reduzir stake base e revisar sizing: drawdown de capital acima do patamar prudencial.');
    if (analysis.summary.advancedRiskOfRuin.probability > 0.3) recommendations.push('Executar revisão de risco de ruína e stress adversarial antes de qualquer hipótese operacional.');
    if (analysis.summary.maxExposureSaturation > 0.85) recommendations.push('Aplicar exposure throttling: saturação de exposição próxima do limite configurado.');
    if (analysis.outcomes.some(outcome => outcome.riskGrade === 'FAIL')) recommendations.push('Rejeitar políticas de stake que falham em simulação de capital.');
    if (analysis.summary.governance.reviewStatus === 'CAPITAL_RESILIENT_CANDIDATE') recommendations.push('Submeter candidato a bootstrap, validação adversarial e revisão manual de risco.');
    return [...new Set(recommendations)];
  }
}
