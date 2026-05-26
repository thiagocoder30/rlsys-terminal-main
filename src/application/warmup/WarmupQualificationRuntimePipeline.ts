import { WarmupSessionAnalyzer, WarmupSessionReport, WarmupTableGate } from '../../domain/session/WarmupSessionAnalyzer';
import { VisionReliabilityInspector, VisionReliabilityReport } from '../../domain/vision/VisionReliabilityInspector';
import { VisionWarmupExtraction, VisionWarmupNormalizer } from '../../domain/vision/VisionWarmupNormalizer';

export type WarmupQualificationSource = 'manual' | 'vision';
export type WarmupQualificationStatus = 'BLOCKED' | 'OBSERVE' | 'QUALIFIED';

export type WarmupQualificationReason =
  | 'EMPTY_INPUT'
  | 'VISION_REJECTED'
  | 'OCR_RELIABILITY_REJECTED'
  | 'WARMUP_TABLE_NO_GO'
  | 'WARMUP_TABLE_OBSERVE'
  | 'WARMUP_TABLE_QUALIFIED'
  | 'INTERNAL_ERROR';

export interface WarmupQualificationRuntimeInput {
  readonly source?: WarmupQualificationSource;
  readonly values?: readonly unknown[];
  readonly visionRaw?: unknown;
  readonly requiredWarmupSize?: number;
}

export interface WarmupCanonicalExtraction {
  readonly values: readonly number[];
  readonly accepted: number;
  readonly rejected: number;
  readonly declaredTotal?: number;
  readonly confidence: number;
  readonly warnings: readonly string[];
  readonly reliability: VisionReliabilityReport;
}

export interface WarmupQualificationDecision {
  readonly tableQualified: boolean;
  readonly supervisedObservationAllowed: boolean;
  readonly supervisedOperationAllowed: boolean;
  readonly liveMoneyAllowed: false;
  readonly productionMoneyAllowed: false;
  readonly requiresHumanReview: true;
}

export interface WarmupQualificationReport {
  readonly service: 'WarmupQualificationRuntimePipeline';
  readonly schemaVersion: '1.0.0';
  readonly generatedAt: string;
  readonly source: WarmupQualificationSource;
  readonly status: WarmupQualificationStatus;
  readonly reason: WarmupQualificationReason;
  readonly operationalGate: 'BLOCKED';
  readonly extraction: WarmupCanonicalExtraction;
  readonly warmup?: WarmupSessionReport;
  readonly confidenceScore: number;
  readonly decision: WarmupQualificationDecision;
  readonly humanExplanation: readonly string[];
}

/**
 * Orquestra o warm-up institucional antes da operação paper/live.
 *
 * Esta aplicação não tenta prever número e não abre gate financeiro.
 * Ela transforma as últimas rodadas em qualificação contextual:
 * OCR/manual -> confiabilidade -> análise estatística -> decisão supervisionada.
 *
 * Complexidade:
 * - Tempo: O(n), onde n é o número de rodadas informadas.
 * - Espaço: O(37), reaproveitando os motores estatísticos de domínio.
 */
export class WarmupQualificationRuntimePipeline {
  private readonly normalizer = new VisionWarmupNormalizer();

  public qualify(input: WarmupQualificationRuntimeInput | unknown): WarmupQualificationReport {
    const normalizedInput = this.normalizeInput(input);
    const requiredWarmupSize = this.resolveRequiredWarmupSize(normalizedInput.requiredWarmupSize);
    const source = normalizedInput.source ?? (normalizedInput.visionRaw !== undefined ? 'vision' : 'manual');

    try {
      const extraction = source === 'vision'
        ? this.extractVision(normalizedInput, requiredWarmupSize)
        : this.extractManual(normalizedInput, requiredWarmupSize);

      if (extraction.values.length === 0) {
        return this.buildReport({
          source,
          status: 'BLOCKED',
          reason: 'EMPTY_INPUT',
          extraction,
          confidenceScore: 0,
          explanation: [
            'Nenhuma rodada válida foi encontrada no warm-up.',
            'Gate operacional permanece bloqueado.'
          ]
        });
      }

      if (extraction.reliability.status === 'REJECTED') {
        return this.buildReport({
          source,
          status: 'BLOCKED',
          reason: 'OCR_RELIABILITY_REJECTED',
          extraction,
          confidenceScore: extraction.reliability.score,
          explanation: [
            'A confiabilidade da extração ficou abaixo do mínimo institucional.',
            'O sistema bloqueou a operação para proteger a banca.'
          ]
        });
      }

      const analyzer = new WarmupSessionAnalyzer({ warmupSize: requiredWarmupSize });
      const warmup = analyzer.analyze(extraction.values);

      return this.reportFromWarmup(source, extraction, warmup);
    } catch (error: unknown) {
      const fallbackExtraction = this.emptyExtraction(requiredWarmupSize);

      return this.buildReport({
        source,
        status: 'BLOCKED',
        reason: 'INTERNAL_ERROR',
        extraction: fallbackExtraction,
        confidenceScore: 0,
        explanation: [
          `Falha controlada no pipeline de warm-up: ${this.describeError(error)}`,
          'Gate operacional permanece bloqueado por segurança.'
        ]
      });
    }
  }

  private normalizeInput(input: WarmupQualificationRuntimeInput | unknown): WarmupQualificationRuntimeInput {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      return {};
    }

    const record = input as Record<string, unknown>;
    const source = this.toSource(record.source);
    const values = Array.isArray(record.values) ? record.values : undefined;
    const requiredWarmupSize = this.toPositiveInteger(record.requiredWarmupSize);

    return {
      source,
      values,
      visionRaw: record.visionRaw ?? record.dataset ?? record.raw,
      requiredWarmupSize
    };
  }

  private extractVision(input: WarmupQualificationRuntimeInput, requiredWarmupSize: number): WarmupCanonicalExtraction {
    const payload = input.visionRaw ?? {
      total: Array.isArray(input.values) ? input.values.length : 0,
      sequencia: input.values ?? []
    };

    const result = this.normalizer.normalize(payload);

    if (!result.success) {
      const extraction = this.emptyExtraction(requiredWarmupSize);

      return {
        ...extraction,
        warnings: [`${result.error.code}:${result.error.message}`]
      };
    }

    return this.fromVisionExtraction(result.value, requiredWarmupSize);
  }

  private extractManual(input: WarmupQualificationRuntimeInput, requiredWarmupSize: number): WarmupCanonicalExtraction {
    const rawValues = input.values ?? [];
    const values: number[] = [];
    let rejected = 0;

    for (const item of rawValues) {
      const value = this.toRouletteValue(item);

      if (value === undefined) {
        rejected += 1;
        continue;
      }

      values.push(value);
    }

    const inspector = new VisionReliabilityInspector({ requiredWarmupSize });
    const reliability = inspector.inspect({
      values,
      rejected,
      declaredTotal: rawValues.length
    });

    return {
      values,
      accepted: values.length,
      rejected,
      declaredTotal: rawValues.length,
      confidence: reliability.score,
      warnings: reliability.issues.map((issue) => issue.code),
      reliability
    };
  }

  private fromVisionExtraction(extraction: VisionWarmupExtraction, requiredWarmupSize: number): WarmupCanonicalExtraction {
    const inspector = new VisionReliabilityInspector({ requiredWarmupSize });
    const reliability = inspector.inspect({
      values: extraction.values,
      rejected: extraction.rejected,
      declaredTotal: extraction.declaredTotal
    });

    return {
      values: extraction.values,
      accepted: extraction.accepted,
      rejected: extraction.rejected,
      declaredTotal: extraction.declaredTotal,
      confidence: reliability.score,
      warnings: [
        ...extraction.warnings,
        ...reliability.issues.map((issue) => issue.code)
      ],
      reliability
    };
  }

  private reportFromWarmup(
    source: WarmupQualificationSource,
    extraction: WarmupCanonicalExtraction,
    warmup: WarmupSessionReport
  ): WarmupQualificationReport {
    const status = this.statusFromGate(warmup.tableGate, extraction.reliability.status);
    const reason = this.reasonFromGate(warmup.tableGate);
    const confidenceScore = this.computeConfidenceScore(extraction.reliability.score, warmup.tableGate);

    return this.buildReport({
      source,
      status,
      reason,
      extraction,
      warmup,
      confidenceScore,
      explanation: this.explain(status, extraction, warmup)
    });
  }

  private buildReport(input: {
    readonly source: WarmupQualificationSource;
    readonly status: WarmupQualificationStatus;
    readonly reason: WarmupQualificationReason;
    readonly extraction: WarmupCanonicalExtraction;
    readonly warmup?: WarmupSessionReport;
    readonly confidenceScore: number;
    readonly explanation: readonly string[];
  }): WarmupQualificationReport {
    return {
      service: 'WarmupQualificationRuntimePipeline',
      schemaVersion: '1.0.0',
      generatedAt: new Date().toISOString(),
      source: input.source,
      status: input.status,
      reason: input.reason,
      operationalGate: 'BLOCKED',
      extraction: input.extraction,
      warmup: input.warmup,
      confidenceScore: Number(input.confidenceScore.toFixed(6)),
      decision: {
        tableQualified: input.status === 'QUALIFIED',
        supervisedObservationAllowed: input.status !== 'BLOCKED',
        supervisedOperationAllowed: input.status === 'QUALIFIED',
        liveMoneyAllowed: false,
        productionMoneyAllowed: false,
        requiresHumanReview: true
      },
      humanExplanation: [
        ...input.explanation,
        'O RL.SYS classifica contexto; ele não promete ganho e não libera dinheiro real.'
      ]
    };
  }

  private statusFromGate(
    tableGate: WarmupTableGate,
    reliabilityStatus: VisionReliabilityReport['status']
  ): WarmupQualificationStatus {
    if (reliabilityStatus === 'REJECTED' || tableGate === 'NO_GO') {
      return 'BLOCKED';
    }

    if (reliabilityStatus === 'REVIEW' || tableGate === 'OBSERVE') {
      return 'OBSERVE';
    }

    return 'QUALIFIED';
  }

  private reasonFromGate(tableGate: WarmupTableGate): WarmupQualificationReason {
    if (tableGate === 'NO_GO') {
      return 'WARMUP_TABLE_NO_GO';
    }

    if (tableGate === 'OBSERVE') {
      return 'WARMUP_TABLE_OBSERVE';
    }

    return 'WARMUP_TABLE_QUALIFIED';
  }

  private explain(
    status: WarmupQualificationStatus,
    extraction: WarmupCanonicalExtraction,
    warmup: WarmupSessionReport
  ): readonly string[] {
    const lines: string[] = [
      `Warm-up processou ${extraction.accepted} rodadas válidas com confiança ${extraction.reliability.score}.`,
      `Gate estatístico da mesa: ${warmup.tableGate}.`,
      `Risco contextual: ${warmup.riskLabel}.`
    ];

    if (status === 'QUALIFIED') {
      lines.push('Mesa qualificada apenas para operação supervisionada em paper.');
    } else if (status === 'OBSERVE') {
      lines.push('Mesa exige observação adicional antes de qualquer oportunidade supervisionada.');
    } else {
      lines.push('Mesa bloqueada por baixa evidência ou risco contextual elevado.');
    }

    return lines;
  }

  private computeConfidenceScore(reliabilityScore: number, tableGate: WarmupTableGate): number {
    const gateFactor = tableGate === 'GO_RESEARCH' ? 1 : tableGate === 'OBSERVE' ? 0.72 : 0.35;
    const score = reliabilityScore * gateFactor;

    if (!Number.isFinite(score) || score < 0) {
      return 0;
    }

    if (score > 1) {
      return 1;
    }

    return score;
  }

  private emptyExtraction(requiredWarmupSize: number): WarmupCanonicalExtraction {
    const inspector = new VisionReliabilityInspector({ requiredWarmupSize });
    const reliability = inspector.inspect({
      values: [],
      rejected: 0,
      declaredTotal: 0
    });

    return {
      values: [],
      accepted: 0,
      rejected: 0,
      declaredTotal: 0,
      confidence: 0,
      warnings: ['EMPTY_EXTRACTION'],
      reliability
    };
  }

  private resolveRequiredWarmupSize(value: number | undefined): number {
    if (value === undefined || !Number.isInteger(value) || value < 80 || value > 500) {
      return 200;
    }

    return value;
  }

  private toSource(value: unknown): WarmupQualificationSource | undefined {
    if (value === 'manual' || value === 'vision') {
      return value;
    }

    return undefined;
  }

  private toRouletteValue(value: unknown): number | undefined {
    const numeric = typeof value === 'number' ? value : Number(String(value).trim());

    if (!Number.isInteger(numeric) || numeric < 0 || numeric > 36) {
      return undefined;
    }

    return numeric;
  }

  private toPositiveInteger(value: unknown): number | undefined {
    const numeric = typeof value === 'number' ? value : Number(String(value).trim());

    if (!Number.isInteger(numeric) || numeric <= 0) {
      return undefined;
    }

    return numeric;
  }

  private describeError(error: unknown): string {
    if (error instanceof Error && error.message.length > 0) {
      return error.message;
    }

    return 'Unknown warmup qualification failure';
  }
}
