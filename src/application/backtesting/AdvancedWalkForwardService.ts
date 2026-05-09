import { AdvancedWalkForwardResult, AdvancedWalkForwardValidator } from '../../domain/backtesting/AdvancedWalkForwardValidator';
import { DatasetEngine } from '../../domain/research/DatasetEngine';
import { DataIntegrityValidator } from '../../domain/research/DataIntegrityValidator';

export interface AdvancedWalkForwardReport {
  status: 'REJECTED' | 'RESEARCH_REVIEW' | 'CANDIDATE';
  operationalGate: 'BLOCKED';
  generatedAt: string;
  datasetChecksum: string;
  result?: AdvancedWalkForwardResult;
  blockers: string[];
  recommendations: string[];
}

export class AdvancedWalkForwardService {
  constructor(
    private readonly datasetEngine = new DatasetEngine(),
    private readonly integrityValidator = new DataIntegrityValidator(),
    private readonly validator = new AdvancedWalkForwardValidator()
  ) {}

  public evaluate(input: string | unknown[]): AdvancedWalkForwardReport {
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

  private recommendations(result: AdvancedWalkForwardResult): string[] {
    const recommendations = ['Manter gate operacional bloqueado: walk-forward é validação de pesquisa, não autorização automática de stake.'];
    if (result.summary.folds < result.options.minFolds) recommendations.push('Aumentar dataset para gerar mais folds independentes.');
    if (result.summary.meanValidationEdge <= 0) recommendations.push('Rejeitar hipótese até existir edge positivo fora da amostra.');
    if (result.summary.overfitRiskScore > 0.45) recommendations.push('Reduzir complexidade da hipótese: risco de overfitting elevado.');
    if (result.summary.outOfSampleConsistency < 0.55) recommendations.push('Investigar instabilidade entre treino e validação.');
    if (result.summary.approval === 'CANDIDATE') recommendations.push('Submeter hipótese a dataset independente, stress adversarial e revisão manual de risco.');
    return [...new Set(recommendations)];
  }
}
