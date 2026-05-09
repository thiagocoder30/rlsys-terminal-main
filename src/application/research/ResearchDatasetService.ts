import { DatasetEngine, DatasetNormalizationResult, DatasetParseResult } from '../../domain/research/DatasetEngine';
import { DataIntegrityValidator, IntegrityReport } from '../../domain/research/DataIntegrityValidator';

export interface ResearchDatasetReport {
  status: 'ACCEPTED' | 'REJECTED' | 'REVIEW';
  parse: DatasetParseResult;
  normalized: DatasetNormalizationResult;
  integrity: IntegrityReport;
  recommendations: string[];
}

export class ResearchDatasetService {
  constructor(
    private readonly datasetEngine = new DatasetEngine(),
    private readonly integrityValidator = new DataIntegrityValidator()
  ) {}

  public evaluate(input: string | unknown[]): ResearchDatasetReport {
    const parse = this.datasetEngine.parse(input);
    const normalized = this.datasetEngine.normalize(parse.records);
    const integrity = this.integrityValidator.validate(normalized.records);
    const rejectedRatio = parse.records.length + parse.rejectedRows.length === 0
      ? 1
      : parse.rejectedRows.length / (parse.records.length + parse.rejectedRows.length);

    const recommendations = this.recommend(integrity, rejectedRatio);
    const status = !integrity.valid || rejectedRatio > 0.1
      ? 'REJECTED'
      : integrity.score >= 0.85 && rejectedRatio === 0
        ? 'ACCEPTED'
        : 'REVIEW';

    return { status, parse, normalized, integrity, recommendations };
  }

  private recommend(integrity: IntegrityReport, rejectedRatio: number): string[] {
    const recommendations: string[] = [];
    if (integrity.totalRecords < 10_000) recommendations.push('Aumentar dataset para milhares/dezenas de milhares de spins antes de inferir edge.');
    if (integrity.timestampCoverage < 0.8) recommendations.push('Coletar timestamps para análise temporal, regime switching e decay de edge.');
    if (integrity.uniqueValues < 37) recommendations.push('Verificar cobertura completa dos números 0-36.');
    if (rejectedRatio > 0) recommendations.push(`Sanear linhas rejeitadas antes de backtests institucionais: ${(rejectedRatio * 100).toFixed(2)}%.`);
    if (!integrity.chronological) recommendations.push('Ordenar o dataset cronologicamente antes de qualquer walk-forward.');
    if (recommendations.length === 0) recommendations.push('Dataset apto para próxima fase de pesquisa estatística controlada.');
    return recommendations;
  }
}
