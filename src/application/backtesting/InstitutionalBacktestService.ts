import { DatasetEngine } from '../../domain/research/DatasetEngine';
import { DataIntegrityValidator } from '../../domain/research/DataIntegrityValidator';
import { InstitutionalBacktestEngine, InstitutionalBacktestResult } from '../../domain/backtesting/InstitutionalBacktestEngine';

export type InstitutionalBacktestStatus = 'REJECTED' | 'RESEARCH_REVIEW' | 'CANDIDATE';

export interface InstitutionalBacktestReport {
  status: InstitutionalBacktestStatus;
  operationalGate: 'BLOCKED';
  generatedAt: string;
  datasetChecksum: string;
  result?: InstitutionalBacktestResult;
  blockers: string[];
  recommendations: string[];
}

export class InstitutionalBacktestService {
  constructor(
    private readonly datasetEngine = new DatasetEngine(),
    private readonly integrityValidator = new DataIntegrityValidator(),
    private readonly backtestEngine = new InstitutionalBacktestEngine()
  ) {}

  public evaluate(input: string | unknown[]): InstitutionalBacktestReport {
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

  private recommendations(result: InstitutionalBacktestResult): string[] {
    const recommendations = ['Manter gate operacional bloqueado: backtest é evidência de pesquisa, não autorização automática de stake.'];
    if (result.summary.trades < 100) recommendations.push('Aumentar amostra para obter mais trades out-of-sample.');
    if (!result.baseline.strategyOutperformed) recommendations.push('Rejeitar hipótese até superar baseline independente.');
    if (result.summary.maxDrawdown > 0.2) recommendations.push('Reduzir stake ou reforçar filtro de risco: drawdown acima do alvo institucional.');
    if (result.stress.some(item => item.riskFlag !== 'PASS')) recommendations.push('Investigar falhas em cenários de stress antes de qualquer revisão operacional.');
    if (result.summary.approval === 'CANDIDATE') recommendations.push('Submeter a validação adversarial, dados independentes e revisão manual de risco.');
    return [...new Set(recommendations)];
  }
}
