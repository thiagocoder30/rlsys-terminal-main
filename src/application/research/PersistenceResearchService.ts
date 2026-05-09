import { DatasetEngine } from '../../domain/research/DatasetEngine';
import { DataIntegrityValidator, IntegrityReport } from '../../domain/research/DataIntegrityValidator';
import { EdgePersistenceAnalyzer, EdgePersistenceReport } from '../../domain/persistence/EdgePersistenceAnalyzer';

export interface PersistenceResearchReport {
  status: 'REJECTED' | 'INCONCLUSIVE' | 'PERSISTENCE_RESEARCH_READY';
  integrity: IntegrityReport;
  persistence: EdgePersistenceReport;
  researchScore: number;
  operationalGate: 'BLOCKED';
  recommendations: string[];
}

export class PersistenceResearchService {
  constructor(
    private readonly datasetEngine = new DatasetEngine(),
    private readonly integrityValidator = new DataIntegrityValidator(),
    private readonly persistenceAnalyzer = new EdgePersistenceAnalyzer()
  ) {}

  public evaluate(input: string | unknown[]): PersistenceResearchReport {
    const parsed = this.datasetEngine.parse(input);
    const normalized = this.datasetEngine.normalize(parsed.records);
    const integrity = this.integrityValidator.validate(normalized.records);
    const values = normalized.records.map(record => record.value);
    const persistence = this.persistenceAnalyzer.analyze(values);
    const researchScore = this.score(integrity.score, persistence.persistenceScore, parsed.rejectedRows.length, parsed.records.length);
    const status = this.status(integrity, persistence, researchScore);

    return {
      status,
      integrity,
      persistence,
      researchScore,
      operationalGate: 'BLOCKED',
      recommendations: this.recommend(status, persistence)
    };
  }

  private score(integrityScore: number, persistenceScore: number, rejectedRows: number, acceptedRows: number): number {
    const rejectionPenalty = acceptedRows + rejectedRows === 0 ? 0.5 : Math.min(0.35, rejectedRows / (acceptedRows + rejectedRows));
    return round(Math.max(0, Math.min(1, integrityScore * 0.4 + persistenceScore * 0.6 - rejectionPenalty)));
  }

  private status(integrity: IntegrityReport, persistence: EdgePersistenceReport, score: number): PersistenceResearchReport['status'] {
    if (!integrity.valid) return 'REJECTED';
    if ((persistence.verdict === 'STRONG_PERSISTENCE' || persistence.verdict === 'MODERATE_PERSISTENCE') && score >= 0.68) {
      return 'PERSISTENCE_RESEARCH_READY';
    }
    return 'INCONCLUSIVE';
  }

  private recommend(status: PersistenceResearchReport['status'], persistence: EdgePersistenceReport): string[] {
    const recommendations = [...persistence.recommendations];
    recommendations.push('Manter gate operacional bloqueado: persistência de edge é evidência de pesquisa, não autorização de aposta.');
    if (status === 'PERSISTENCE_RESEARCH_READY') recommendations.push('Próxima etapa obrigatória: Research Reporting Layer com trilha reproduzível e validação adversarial.');
    return [...new Set(recommendations)];
  }
}

function round(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(6));
}
