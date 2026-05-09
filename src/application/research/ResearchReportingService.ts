import crypto from 'crypto';
import { ResearchDatasetReport, ResearchDatasetService } from './ResearchDatasetService';
import { StatisticalResearchReport, StatisticalResearchService } from './StatisticalResearchService';
import { SequentialResearchReport, SequentialResearchService } from './SequentialResearchService';
import { PersistenceResearchReport, PersistenceResearchService } from './PersistenceResearchService';

export type ResearchReportStatus = 'REJECTED' | 'INCONCLUSIVE' | 'RESEARCH_REVIEW_READY';
export type ResearchEvidenceGrade = 'NONE' | 'WEAK' | 'MODERATE' | 'STRONG';

export interface ResearchExecutiveSummary {
  status: ResearchReportStatus;
  evidenceGrade: ResearchEvidenceGrade;
  operationalGate: 'BLOCKED';
  compositeScore: number;
  confidence: number;
  blockers: string[];
  warnings: string[];
  recommendations: string[];
}

export interface ResearchReproducibilityEnvelope {
  reportId: string;
  generatedAt: string;
  schemaVersion: 'research-report.v1';
  datasetChecksum: string;
  engineVersion: string;
  moduleVersions: Record<string, string>;
}

export interface UnifiedResearchReport {
  envelope: ResearchReproducibilityEnvelope;
  executiveSummary: ResearchExecutiveSummary;
  dataset: ResearchDatasetReport;
  statistics: StatisticalResearchReport;
  sequential: SequentialResearchReport;
  persistence: PersistenceResearchReport;
  auditTrail: string[];
}

export class ResearchReportingService {
  constructor(
    private readonly engineVersion = '1.5.0',
    private readonly datasetService = new ResearchDatasetService(),
    private readonly statisticalService = new StatisticalResearchService(),
    private readonly sequentialService = new SequentialResearchService(),
    private readonly persistenceService = new PersistenceResearchService()
  ) {}

  public evaluate(input: string | unknown[]): UnifiedResearchReport {
    const dataset = this.datasetService.evaluate(input);
    const statistics = this.statisticalService.evaluate(input);
    const sequential = this.sequentialService.evaluate(input);
    const persistence = this.persistenceService.evaluate(input);
    const compositeScore = this.compositeScore(dataset, statistics, sequential, persistence);
    const blockers = this.blockers(dataset, statistics, sequential, persistence);
    const warnings = this.warnings(dataset, statistics, sequential, persistence);
    const status = this.status(blockers, compositeScore, statistics, sequential, persistence);
    const evidenceGrade = this.grade(compositeScore, status);
    const recommendations = this.recommendations(dataset, statistics, sequential, persistence, status);
    const datasetChecksum = dataset.normalized.checksum ?? 'unavailable';
    const reportId = stableHash({ datasetChecksum, compositeScore, status, evidenceGrade, engineVersion: this.engineVersion }).slice(0, 24);

    return {
      envelope: {
        reportId,
        generatedAt: new Date().toISOString(),
        schemaVersion: 'research-report.v1',
        datasetChecksum,
        engineVersion: this.engineVersion,
        moduleVersions: {
          dataset: '1.1.0',
          statistics: '1.2.0',
          sequential: '1.3.0',
          persistence: '1.4.0',
          reporting: '1.5.0'
        }
      },
      executiveSummary: {
        status,
        evidenceGrade,
        operationalGate: 'BLOCKED',
        compositeScore,
        confidence: this.confidence(dataset, statistics, sequential, persistence),
        blockers,
        warnings,
        recommendations
      },
      dataset,
      statistics,
      sequential,
      persistence,
      auditTrail: this.auditTrail(dataset, statistics, sequential, persistence, status)
    };
  }

  private compositeScore(dataset: ResearchDatasetReport, statistics: StatisticalResearchReport, sequential: SequentialResearchReport, persistence: PersistenceResearchReport): number {
    if (dataset.status === 'REJECTED') return 0;
    return round(
      dataset.integrity.score * 0.2 +
      statistics.scientificScore * 0.25 +
      sequential.temporalEvidenceScore * 0.25 +
      persistence.researchScore * 0.3
    );
  }

  private confidence(dataset: ResearchDatasetReport, statistics: StatisticalResearchReport, sequential: SequentialResearchReport, persistence: PersistenceResearchReport): number {
    const sampleFactor = Math.min(1, dataset.normalized.metadata.totalRecords / 10_000);
    const agreement = [statistics.status, sequential.status, persistence.status].filter(status => status !== 'INCONCLUSIVE').length / 3;
    return round(Math.max(0, Math.min(1, sampleFactor * 0.45 + agreement * 0.35 + dataset.integrity.score * 0.2)));
  }

  private blockers(dataset: ResearchDatasetReport, statistics: StatisticalResearchReport, sequential: SequentialResearchReport, persistence: PersistenceResearchReport): string[] {
    const blockers: string[] = [];
    if (dataset.status === 'REJECTED') blockers.push('dataset_rejected');
    if (!dataset.integrity.valid) blockers.push('integrity_invalid');
    if (statistics.hypothesis.productionGate === 'BLOCK') blockers.push('hypothesis_gate_blocked');
    if (persistence.operationalGate === 'BLOCKED') blockers.push('operational_gate_blocked_by_design');
    return [...new Set(blockers)];
  }

  private warnings(dataset: ResearchDatasetReport, statistics: StatisticalResearchReport, sequential: SequentialResearchReport, persistence: PersistenceResearchReport): string[] {
    const warnings: string[] = [];
    if (dataset.normalized.metadata.totalRecords < 10_000) warnings.push('sample_below_institutional_research_target_10000');
    if (statistics.significance.statisticalRisk !== 'low') warnings.push(`statistical_risk_${statistics.significance.statisticalRisk}`);
    if (sequential.status === 'INCONCLUSIVE') warnings.push('sequential_evidence_inconclusive');
    if (persistence.status === 'INCONCLUSIVE') warnings.push('persistence_evidence_inconclusive');
    return [...new Set(warnings)];
  }

  private status(blockers: string[], compositeScore: number, statistics: StatisticalResearchReport, sequential: SequentialResearchReport, persistence: PersistenceResearchReport): ResearchReportStatus {
    if (blockers.includes('dataset_rejected') || blockers.includes('integrity_invalid')) return 'REJECTED';
    const hasCrossModuleEvidence = statistics.status !== 'INCONCLUSIVE' && sequential.status !== 'INCONCLUSIVE' && persistence.status !== 'INCONCLUSIVE';
    if (hasCrossModuleEvidence && compositeScore >= 0.72) return 'RESEARCH_REVIEW_READY';
    return 'INCONCLUSIVE';
  }

  private grade(score: number, status: ResearchReportStatus): ResearchEvidenceGrade {
    if (status === 'REJECTED' || score < 0.35) return 'NONE';
    if (score >= 0.78) return 'STRONG';
    if (score >= 0.62) return 'MODERATE';
    return 'WEAK';
  }

  private recommendations(dataset: ResearchDatasetReport, statistics: StatisticalResearchReport, sequential: SequentialResearchReport, persistence: PersistenceResearchReport, status: ResearchReportStatus): string[] {
    const recommendations = [
      ...dataset.recommendations,
      ...statistics.recommendations,
      ...sequential.recommendations,
      ...persistence.recommendations,
      'Nunca converter relatório de pesquisa em recomendação operacional sem validação adversarial e out-of-sample independente.'
    ];
    if (status === 'RESEARCH_REVIEW_READY') recommendations.push('Submeter o relatório a revisão manual: evidência consolidada é pesquisa, não autorização de stake.');
    return [...new Set(recommendations)].slice(0, 24);
  }

  private auditTrail(dataset: ResearchDatasetReport, statistics: StatisticalResearchReport, sequential: SequentialResearchReport, persistence: PersistenceResearchReport, status: ResearchReportStatus): string[] {
    return [
      `dataset:${dataset.status}:records=${dataset.normalized.metadata.totalRecords}:checksum=${dataset.normalized.checksum}`,
      `statistics:${statistics.status}:p=${statistics.significance.pValue}:score=${statistics.scientificScore}`,
      `sequential:${sequential.status}:score=${sequential.temporalEvidenceScore}`,
      `persistence:${persistence.status}:score=${persistence.researchScore}`,
      `final:${status}:operationalGate=BLOCKED`
    ];
  }
}

function stableHash(input: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(input)).digest('hex');
}

function round(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(6));
}
