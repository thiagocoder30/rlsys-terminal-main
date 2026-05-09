import { DatasetEngine } from '../../domain/research/DatasetEngine';
import { DataIntegrityValidator, IntegrityReport } from '../../domain/research/DataIntegrityValidator';
import { HypothesisValidationResult, HypothesisValidator } from '../../domain/statistics/HypothesisValidator';
import { StatisticalSignificanceEngine, StatisticalSignificanceReport } from '../../domain/statistics/StatisticalSignificanceEngine';

export interface StatisticalResearchReport {
  status: 'REJECTED' | 'INCONCLUSIVE' | 'RESEARCH_READY';
  integrity: IntegrityReport;
  significance: StatisticalSignificanceReport;
  hypothesis: HypothesisValidationResult;
  scientificScore: number;
  recommendations: string[];
}

export class StatisticalResearchService {
  constructor(
    private readonly datasetEngine = new DatasetEngine(),
    private readonly integrityValidator = new DataIntegrityValidator(),
    private readonly significanceEngine = new StatisticalSignificanceEngine(),
    private readonly hypothesisValidator = new HypothesisValidator()
  ) {}

  public evaluate(input: string | unknown[]): StatisticalResearchReport {
    const parsed = this.datasetEngine.parse(input);
    const normalized = this.datasetEngine.normalize(parsed.records);
    const integrity = this.integrityValidator.validate(normalized.records);
    const values = normalized.records.map(record => record.value);
    const significance = this.significanceEngine.analyze(values);
    const hypothesis = this.hypothesisValidator.validateUniformRandomness(significance);
    const scientificScore = this.score(integrity.score, significance.evidenceScore, parsed.rejectedRows.length, parsed.records.length);
    const status = this.status(integrity, significance, hypothesis, scientificScore);

    return {
      status,
      integrity,
      significance,
      hypothesis,
      scientificScore,
      recommendations: this.recommend(status, significance, hypothesis)
    };
  }

  private score(integrityScore: number, evidenceScore: number, rejectedRows: number, acceptedRows: number): number {
    const rejectionPenalty = acceptedRows + rejectedRows === 0 ? 0.5 : Math.min(0.4, rejectedRows / (acceptedRows + rejectedRows));
    return Number(Math.max(0, Math.min(1, integrityScore * 0.5 + evidenceScore * 0.5 - rejectionPenalty)).toFixed(6));
  }

  private status(integrity: IntegrityReport, significance: StatisticalSignificanceReport, hypothesis: HypothesisValidationResult, scientificScore: number): StatisticalResearchReport['status'] {
    if (!integrity.valid) return 'REJECTED';
    if (hypothesis.productionGate === 'BLOCK') return 'INCONCLUSIVE';
    if (scientificScore >= 0.7 && significance.verdict !== 'NO_EVIDENCE') return 'RESEARCH_READY';
    return 'INCONCLUSIVE';
  }

  private recommend(status: StatisticalResearchReport['status'], significance: StatisticalSignificanceReport, hypothesis: HypothesisValidationResult): string[] {
    const recommendations = [...significance.recommendations, ...hypothesis.rationale];
    if (status !== 'RESEARCH_READY') recommendations.push('Manter bloqueio operacional: relatório serve para pesquisa, não para execução de stake.');
    if (significance.significantAt95) recommendations.push('Executar validação out-of-sample, walk-forward e edge persistence antes de qualquer conclusão.');
    return [...new Set(recommendations)];
  }
}
