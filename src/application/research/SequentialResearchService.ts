import { DatasetEngine } from '../../domain/research/DatasetEngine';
import { DataIntegrityValidator, IntegrityReport } from '../../domain/research/DataIntegrityValidator';
import { SequentialBiasDetector, SequentialBiasReport } from '../../domain/sequential/SequentialBiasDetector';

export interface SequentialResearchReport {
  status: 'REJECTED' | 'INCONCLUSIVE' | 'TEMPORAL_RESEARCH_READY';
  integrity: IntegrityReport;
  sequential: SequentialBiasReport;
  temporalEvidenceScore: number;
  recommendations: string[];
}

export class SequentialResearchService {
  constructor(
    private readonly datasetEngine = new DatasetEngine(),
    private readonly integrityValidator = new DataIntegrityValidator(),
    private readonly sequentialBiasDetector = new SequentialBiasDetector()
  ) {}

  public evaluate(input: string | unknown[]): SequentialResearchReport {
    const parsed = this.datasetEngine.parse(input);
    const normalized = this.datasetEngine.normalize(parsed.records);
    const integrity = this.integrityValidator.validate(normalized.records);
    const values = normalized.records.map(record => record.value);
    const sequential = this.sequentialBiasDetector.analyze(values);
    const temporalEvidenceScore = this.score(integrity.score, sequential.sequentialBiasScore, parsed.rejectedRows.length, parsed.records.length);
    const status = this.status(integrity, sequential, temporalEvidenceScore);

    return {
      status,
      integrity,
      sequential,
      temporalEvidenceScore,
      recommendations: this.recommend(status, sequential)
    };
  }

  private score(integrityScore: number, sequentialScore: number, rejectedRows: number, acceptedRows: number): number {
    const rejectionPenalty = acceptedRows + rejectedRows === 0 ? 0.5 : Math.min(0.35, rejectedRows / (acceptedRows + rejectedRows));
    return round(Math.max(0, Math.min(1, integrityScore * 0.45 + sequentialScore * 0.55 - rejectionPenalty)));
  }

  private status(integrity: IntegrityReport, sequential: SequentialBiasReport, score: number): SequentialResearchReport['status'] {
    if (!integrity.valid) return 'REJECTED';
    if (sequential.verdict === 'STRONG_TEMPORAL_EVIDENCE' && score >= 0.72) return 'TEMPORAL_RESEARCH_READY';
    if (sequential.verdict === 'MODERATE_TEMPORAL_EVIDENCE' && score >= 0.62) return 'TEMPORAL_RESEARCH_READY';
    return 'INCONCLUSIVE';
  }

  private recommend(status: SequentialResearchReport['status'], sequential: SequentialBiasReport): string[] {
    const recommendations = [...sequential.recommendations];
    if (status !== 'TEMPORAL_RESEARCH_READY') recommendations.push('Manter bloqueio operacional: evidência temporal ainda não é suficiente para sugerir stake.');
    if (status === 'TEMPORAL_RESEARCH_READY') recommendations.push('Executar Sprint 1.4 Edge Persistence antes de qualquer promoção operacional.');
    return [...new Set(recommendations)];
  }
}

function round(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(6));
}
