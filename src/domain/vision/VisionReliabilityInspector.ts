export type VisionReliabilityStatus = 'ACCEPTED' | 'REVIEW' | 'REJECTED';
export type VisionReliabilityRisk = 'LOW' | 'MEDIUM' | 'HIGH';

export interface VisionReliabilityIssue {
  readonly code: string;
  readonly severity: 'INFO' | 'WARN' | 'BLOCKER';
  readonly message: string;
}

export interface VisionReliabilityInput {
  readonly values: readonly number[];
  readonly rejected: number;
  readonly declaredTotal?: number;
  readonly itemConfidences?: readonly number[];
}

export interface VisionReliabilityReport {
  readonly status: VisionReliabilityStatus;
  readonly risk: VisionReliabilityRisk;
  readonly score: number;
  readonly accepted: number;
  readonly rejected: number;
  readonly rejectedRatio: number;
  readonly distinctValues: number;
  readonly maxRepeatRun: number;
  readonly normalizedEntropy: number;
  readonly averageItemConfidence?: number;
  readonly correctionRequired: boolean;
  readonly issues: readonly VisionReliabilityIssue[];
}

/**
 * Performs vendor-neutral OCR reliability inspection for the 100-round warm-up.
 *
 * Architecture: this is a pure domain service. It never talks to Gemini, HTTP,
 * files, UI or persistence. Vision adapters can change without forcing the
 * enterprise warm-up rules to change.
 *
 * Complexity: O(n) time over extracted values and O(k) space where k <= 37 for
 * roulette value frequencies. This keeps the service safe for Helio P22/2GB RAM.
 */
export class VisionReliabilityInspector {
  private readonly requiredWarmupSize: number;
  private readonly maxSafeRejectedRatio: number;
  private readonly maxReviewRejectedRatio: number;
  private readonly maxSafeRepeatRun: number;
  private readonly minReviewConfidence: number;

  public constructor(config?: {
    readonly requiredWarmupSize?: number;
    readonly maxSafeRejectedRatio?: number;
    readonly maxReviewRejectedRatio?: number;
    readonly maxSafeRepeatRun?: number;
    readonly minReviewConfidence?: number;
  }) {
    this.requiredWarmupSize = config?.requiredWarmupSize ?? 100;
    this.maxSafeRejectedRatio = config?.maxSafeRejectedRatio ?? 0.02;
    this.maxReviewRejectedRatio = config?.maxReviewRejectedRatio ?? 0.12;
    this.maxSafeRepeatRun = config?.maxSafeRepeatRun ?? 8;
    this.minReviewConfidence = config?.minReviewConfidence ?? 0.72;
  }

  public inspect(input: VisionReliabilityInput): VisionReliabilityReport {
    const issues: VisionReliabilityIssue[] = [];
    const accepted = input.values.length;
    const totalSeen = accepted + input.rejected;
    const rejectedRatio = totalSeen === 0 ? 1 : input.rejected / totalSeen;
    const frequencies = new Map<number, number>();
    let maxRepeatRun = 0;
    let currentRun = 0;
    let previous: number | undefined;

    for (const value of input.values) {
      frequencies.set(value, (frequencies.get(value) ?? 0) + 1);
      if (value === previous) currentRun += 1;
      else currentRun = 1;
      if (currentRun > maxRepeatRun) maxRepeatRun = currentRun;
      previous = value;
    }

    const normalizedEntropy = this.normalizedEntropy(frequencies, Math.max(1, accepted));
    const averageItemConfidence = this.averageConfidence(input.itemConfidences);

    if (accepted < this.requiredWarmupSize) {
      issues.push({
        code: 'OCR_WARMUP_INCOMPLETE',
        severity: accepted < 80 ? 'BLOCKER' : 'WARN',
        message: `Extração retornou ${accepted}/${this.requiredWarmupSize} números válidos.`
      });
    }

    if (input.declaredTotal !== undefined && input.declaredTotal !== accepted) {
      issues.push({
        code: 'OCR_DECLARED_TOTAL_MISMATCH',
        severity: 'WARN',
        message: `Total declarado ${input.declaredTotal} difere dos ${accepted} números aceitos.`
      });
    }

    if (rejectedRatio > this.maxReviewRejectedRatio) {
      issues.push({ code: 'OCR_REJECTION_RATIO_HIGH', severity: 'BLOCKER', message: 'Taxa de rejeição do OCR acima do limite de segurança.' });
    } else if (rejectedRatio > this.maxSafeRejectedRatio) {
      issues.push({ code: 'OCR_REJECTION_RATIO_REVIEW', severity: 'WARN', message: 'Taxa de rejeição do OCR exige revisão manual.' });
    }

    if (maxRepeatRun > this.maxSafeRepeatRun) {
      issues.push({ code: 'OCR_REPEAT_RUN_DRIFT', severity: 'WARN', message: 'Sequência repetida longa pode indicar drift, reflexo ou leitura duplicada.' });
    }

    if (accepted >= this.requiredWarmupSize && normalizedEntropy < 0.58) {
      issues.push({ code: 'OCR_LOW_DISTRIBUTION_ENTROPY', severity: 'WARN', message: 'Distribuição extraída está concentrada demais para liberar sem conferência.' });
    }

    if (averageItemConfidence !== undefined && averageItemConfidence < this.minReviewConfidence) {
      issues.push({ code: 'OCR_LOW_ITEM_CONFIDENCE', severity: 'WARN', message: 'Confiança média por item abaixo do mínimo para operação assistida.' });
    }

    const blockerCount = issues.filter(issue => issue.severity === 'BLOCKER').length;
    const warnCount = issues.filter(issue => issue.severity === 'WARN').length;
    const scorePenalty = rejectedRatio * 0.45 + warnCount * 0.07 + blockerCount * 0.34 + (averageItemConfidence === undefined ? 0 : Math.max(0, 0.88 - averageItemConfidence) * 0.2);
    const score = this.clamp01(1 - scorePenalty);
    const status: VisionReliabilityStatus = blockerCount > 0 ? 'REJECTED' : warnCount > 0 || score < 0.86 ? 'REVIEW' : 'ACCEPTED';
    const risk: VisionReliabilityRisk = status === 'REJECTED' || score < 0.55 ? 'HIGH' : status === 'REVIEW' || score < 0.86 ? 'MEDIUM' : 'LOW';

    return {
      status,
      risk,
      score: Number(score.toFixed(6)),
      accepted,
      rejected: input.rejected,
      rejectedRatio: Number(rejectedRatio.toFixed(6)),
      distinctValues: frequencies.size,
      maxRepeatRun,
      normalizedEntropy: Number(normalizedEntropy.toFixed(6)),
      averageItemConfidence,
      correctionRequired: status !== 'ACCEPTED',
      issues
    };
  }

  private normalizedEntropy(frequencies: ReadonlyMap<number, number>, total: number): number {
    if (frequencies.size <= 1) return 0;
    let entropy = 0;
    frequencies.forEach(count => {
      const probability = count / total;
      entropy -= probability * Math.log2(probability);
    });
    return this.clamp01(entropy / Math.log2(37));
  }

  private averageConfidence(confidences?: readonly number[]): number | undefined {
    if (!confidences || confidences.length === 0) return undefined;
    let total = 0;
    let accepted = 0;
    for (const confidence of confidences) {
      if (Number.isFinite(confidence) && confidence >= 0 && confidence <= 1) {
        total += confidence;
        accepted += 1;
      }
    }
    if (accepted === 0) return undefined;
    return Number((total / accepted).toFixed(6));
  }

  private clamp01(value: number): number {
    if (!Number.isFinite(value)) return 0;
    if (value < 0) return 0;
    if (value > 1) return 1;
    return value;
  }
}
