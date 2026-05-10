import { DataIntegrityValidator } from '../../domain/research/DataIntegrityValidator';
import { DatasetEngine } from '../../domain/research/DatasetEngine';
import { WarmupSessionAnalyzer, WarmupSessionReport } from '../../domain/session/WarmupSessionAnalyzer';
import { VisionWarmupExtraction, VisionWarmupNormalizer } from '../../domain/vision/VisionWarmupNormalizer';

export type WarmupInputSource = 'dataset' | 'vision' | 'manual';

export interface WarmupSessionServiceInput {
  readonly source?: WarmupInputSource;
  readonly dataset?: unknown;
  readonly visionRaw?: string | unknown;
  readonly values?: readonly number[];
}

export interface WarmupSessionServiceReport {
  readonly service: 'WarmupSessionService';
  readonly schemaVersion: '2.7.0';
  readonly status: 'ACCEPTED' | 'REVIEW' | 'REJECTED';
  readonly source: WarmupInputSource;
  readonly extraction?: VisionWarmupExtraction;
  readonly dataset: {
    readonly totalRecords: number;
    readonly rejectedRows: number;
    readonly checksum?: string;
    readonly integrityScore: number;
  };
  readonly warmup?: WarmupSessionReport;
  readonly executiveSummary: {
    readonly tableGate: 'GO_RESEARCH' | 'OBSERVE' | 'NO_GO';
    readonly operationalGate: 'BLOCKED';
    readonly headline: string;
    readonly recommendations: string[];
  };
  readonly generatedAt: string;
}

/**
 * Application boundary for the 100-round warm-up flow.
 * It adapts manual datasets and OCR outputs into the same canonical domain analyzer.
 */
export class WarmupSessionService {
  private readonly datasetEngine = new DatasetEngine();
  private readonly integrityValidator = new DataIntegrityValidator({ minRecords: 100, maxDuplicateRatio: 0.55, maxRepeatRun: 14 });
  private readonly visionNormalizer = new VisionWarmupNormalizer();
  private readonly analyzer = new WarmupSessionAnalyzer({ warmupSize: 100 });

  public evaluate(input: WarmupSessionServiceInput | unknown): WarmupSessionServiceReport {
    const normalizedInput = this.normalizeInput(input);
    const source = normalizedInput.source ?? 'dataset';
    const extraction = source === 'vision' ? this.extractVision(normalizedInput.visionRaw ?? normalizedInput.dataset) : undefined;

    if (source === 'vision' && !extraction) return this.rejected(source, 'OCR/visão não retornou números válidos.', 0, 0);

    const rawDataset = extraction?.values ?? normalizedInput.values ?? normalizedInput.dataset ?? [];
    const parsed = this.datasetEngine.parse(Array.isArray(rawDataset) ? [...rawDataset] : String(rawDataset ?? ''));
    const normalized = this.datasetEngine.normalize(parsed.records);
    const integrity = this.integrityValidator.validate(normalized.records);

    if (!integrity.valid || normalized.records.length < 80) {
      return {
        service: 'WarmupSessionService',
        schemaVersion: '2.7.0',
        status: 'REJECTED',
        source,
        extraction,
        dataset: {
          totalRecords: normalized.records.length,
          rejectedRows: parsed.rejectedRows.length,
          checksum: normalized.checksum,
          integrityScore: integrity.score
        },
        executiveSummary: {
          tableGate: 'NO_GO',
          operationalGate: 'BLOCKED',
          headline: 'Warm-up rejeitado por integridade insuficiente ou menos de 80 números válidos.',
          recommendations: [
            'Enviar imagem/dataset com as últimas 100 rodadas legíveis.',
            ...integrity.issues.slice(0, 5).map(issue => `${issue.code}: ${issue.message}`)
          ]
        },
        generatedAt: new Date().toISOString()
      };
    }

    const values = normalized.records.map(record => record.value);
    const warmup = this.analyzer.analyze(values);
    const status = warmup.tableGate === 'NO_GO' ? 'REJECTED' : warmup.tableGate === 'OBSERVE' ? 'REVIEW' : 'ACCEPTED';

    return {
      service: 'WarmupSessionService',
      schemaVersion: '2.7.0',
      status,
      source,
      extraction,
      dataset: {
        totalRecords: normalized.records.length,
        rejectedRows: parsed.rejectedRows.length,
        checksum: normalized.checksum,
        integrityScore: integrity.score
      },
      warmup,
      executiveSummary: {
        tableGate: warmup.tableGate,
        operationalGate: 'BLOCKED',
        headline: this.headline(warmup),
        recommendations: warmup.recommendations
      },
      generatedAt: new Date().toISOString()
    };
  }

  private normalizeInput(input: WarmupSessionServiceInput | unknown): WarmupSessionServiceInput {
    if (input && typeof input === 'object' && !Array.isArray(input)) return input as WarmupSessionServiceInput;
    if (Array.isArray(input)) return { source: 'manual', values: input.filter((item): item is number => typeof item === 'number') };
    return { source: 'dataset', dataset: input };
  }

  private extractVision(raw: string | unknown): VisionWarmupExtraction | undefined {
    const result = this.visionNormalizer.normalize(raw);
    return result.success ? result.value : undefined;
  }

  private rejected(source: WarmupInputSource, headline: string, totalRecords: number, rejectedRows: number): WarmupSessionServiceReport {
    return {
      service: 'WarmupSessionService',
      schemaVersion: '2.7.0',
      status: 'REJECTED',
      source,
      dataset: { totalRecords, rejectedRows, integrityScore: 0 },
      executiveSummary: {
        tableGate: 'NO_GO',
        operationalGate: 'BLOCKED',
        headline,
        recommendations: ['Reenviar imagem com maior nitidez ou inserir manualmente as últimas 100 rodadas.']
      },
      generatedAt: new Date().toISOString()
    };
  }

  private headline(warmup: WarmupSessionReport): string {
    if (warmup.tableGate === 'GO_RESEARCH') return 'Warm-up aceito para pesquisa: mesa legível e sem bloqueadores críticos.';
    if (warmup.tableGate === 'OBSERVE') return 'Warm-up em observação: há sinais moderados, mas gate operacional permanece bloqueado.';
    return 'Warm-up NO GO: mesa incompleta, hostil ou com risco estatístico elevado.';
  }
}
