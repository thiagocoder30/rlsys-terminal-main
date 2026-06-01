export type WarmupUploadIngestionDecision =
  | 'PAPER_COMPATIVEL'
  | 'AGUARDAR'
  | 'NAO_UTILIZAR';

export type WarmupUploadIngestionReason =
  | 'WARMUP_UPLOAD_ACCEPTED'
  | 'WARMUP_UPLOAD_NEEDS_MORE_ROUNDS'
  | 'INVALID_WARMUP_UPLOAD_INPUT';

export interface WarmupUploadIngestionPolicy {
  readonly requiredWarmupSize: number;
  readonly minimumRouletteNumber: number;
  readonly maximumRouletteNumber: number;
}

export interface WarmupUploadIngestionInput {
  readonly source: string;
  readonly payload: string;
  readonly policy: WarmupUploadIngestionPolicy;
}

export interface WarmupUploadIngestionMetrics {
  readonly extractedRounds: number;
  readonly acceptedRounds: number;
  readonly discardedRounds: number;
  readonly zeroCount: number;
  readonly redCount: number;
  readonly blackCount: number;
  readonly unknownColorCount: number;
}

export interface WarmupUploadIngestionEvaluation {
  readonly decision: WarmupUploadIngestionDecision;
  readonly reason: WarmupUploadIngestionReason;
  readonly source: string;
  readonly values: readonly number[];
  readonly metrics: WarmupUploadIngestionMetrics;
  readonly productionMoneyAllowed: false;
  readonly activeSessionMutationAllowed: false;
  readonly explanation: string;
}

export type WarmupUploadIngestionResult =
  | {
      readonly ok: true;
      readonly value: WarmupUploadIngestionEvaluation;
    }
  | {
      readonly ok: false;
      readonly error: WarmupUploadIngestionEvaluation;
    };

const EMPTY_METRICS: WarmupUploadIngestionMetrics = {
  extractedRounds: 0,
  acceptedRounds: 0,
  discardedRounds: 0,
  zeroCount: 0,
  redCount: 0,
  blackCount: 0,
  unknownColorCount: 0,
};

const RED_NUMBERS = new Set<number>([
  1, 3, 5, 7, 9, 12, 14, 16, 18,
  19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

const BLACK_NUMBERS = new Set<number>([
  2, 4, 6, 8, 10, 11, 13, 15, 17,
  20, 22, 24, 26, 28, 29, 31, 33, 35,
]);

/**
 * WarmupUploadIngestionEngine normalizes uploaded/manual warmup data into the
 * last N roulette rounds required by the PAPER operation flow.
 *
 * Supported payloads:
 * - JSON array: [1,2,3]
 * - JSON object: { "values": [1,2,3] }, { "rounds": [...] } or { "numbers": [...] }
 * - Text/CSV copied from OCR fallback: "1, 2, 3 ..."
 *
 * Complexity:
 * - Time: O(n)
 * - Space: O(n), only for the normalized warmup output.
 */
export class WarmupUploadIngestionEngine {
  public evaluate(
    input: WarmupUploadIngestionInput,
  ): WarmupUploadIngestionResult {
    const invalidPolicy = this.validatePolicy(input.policy);

    if (
      invalidPolicy !== null ||
      input.source.trim().length === 0 ||
      input.payload.trim().length === 0
    ) {
      return {
        ok: false,
        error: this.invalidEvaluation(input.source),
      };
    }

    const extracted = this.extractNumbers(input.payload);

    if (extracted === null) {
      return {
        ok: false,
        error: this.invalidEvaluation(input.source),
      };
    }

    const accepted: number[] = [];
    let discardedRounds = 0;

    for (const value of extracted) {
      if (
        Number.isInteger(value) &&
        value >= input.policy.minimumRouletteNumber &&
        value <= input.policy.maximumRouletteNumber
      ) {
        accepted.push(value);
      } else {
        discardedRounds += 1;
      }
    }

    if (accepted.length < input.policy.requiredWarmupSize) {
      return {
        ok: true,
        value: {
          decision: 'AGUARDAR',
          reason: 'WARMUP_UPLOAD_NEEDS_MORE_ROUNDS',
          source: input.source,
          values: accepted,
          metrics: this.computeMetrics(
            extracted.length,
            accepted,
            discardedRounds,
          ),
          productionMoneyAllowed: false,
          activeSessionMutationAllowed: false,
          explanation:
            'O warmup enviado ainda não possui rodadas suficientes para iniciar a operação PAPER supervisionada.',
        },
      };
    }

    const values = accepted.slice(
      accepted.length - input.policy.requiredWarmupSize,
    );

    return {
      ok: true,
      value: {
        decision: 'PAPER_COMPATIVEL',
        reason: 'WARMUP_UPLOAD_ACCEPTED',
        source: input.source,
        values,
        metrics: this.computeMetrics(
          extracted.length,
          values,
          discardedRounds + accepted.length - values.length,
        ),
        productionMoneyAllowed: false,
        activeSessionMutationAllowed: false,
        explanation:
          'O warmup foi normalizado com segurança e está pronto para qualificação institucional PAPER.',
      },
    };
  }

  private validatePolicy(policy: WarmupUploadIngestionPolicy): string | null {
    if (
      !Number.isFinite(policy.requiredWarmupSize) ||
      !Number.isFinite(policy.minimumRouletteNumber) ||
      !Number.isFinite(policy.maximumRouletteNumber) ||
      policy.requiredWarmupSize <= 0 ||
      policy.minimumRouletteNumber < 0 ||
      policy.maximumRouletteNumber <= policy.minimumRouletteNumber
    ) {
      return 'invalid-policy';
    }

    return null;
  }

  private extractNumbers(payload: string): readonly number[] | null {
    const trimmed = payload.trim();

    const fromJson = this.extractFromJson(trimmed);

    if (fromJson !== null) {
      return fromJson;
    }

    const matches = trimmed.match(/\d+/g);

    if (matches === null) {
      return null;
    }

    return matches.map((match) => Number.parseInt(match, 10));
  }

  private extractFromJson(payload: string): readonly number[] | null {
    try {
      const parsed: unknown = JSON.parse(payload);

      if (Array.isArray(parsed)) {
        return this.extractArrayNumbers(parsed);
      }

      if (this.isRecord(parsed)) {
        const candidates = [parsed.values, parsed.rounds, parsed.numbers];

        for (const candidate of candidates) {
          if (Array.isArray(candidate)) {
            return this.extractArrayNumbers(candidate);
          }
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  private extractArrayNumbers(values: readonly unknown[]): readonly number[] {
    const numbers: number[] = [];

    for (const value of values) {
      if (typeof value === 'number') {
        numbers.push(value);
      } else if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
        numbers.push(Number.parseInt(value.trim(), 10));
      }
    }

    return numbers;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private computeMetrics(
    extractedRounds: number,
    values: readonly number[],
    discardedRounds: number,
  ): WarmupUploadIngestionMetrics {
    let zeroCount = 0;
    let redCount = 0;
    let blackCount = 0;
    let unknownColorCount = 0;

    for (const value of values) {
      if (value === 0) {
        zeroCount += 1;
      } else if (RED_NUMBERS.has(value)) {
        redCount += 1;
      } else if (BLACK_NUMBERS.has(value)) {
        blackCount += 1;
      } else {
        unknownColorCount += 1;
      }
    }

    return {
      extractedRounds,
      acceptedRounds: values.length,
      discardedRounds,
      zeroCount,
      redCount,
      blackCount,
      unknownColorCount,
    };
  }

  private invalidEvaluation(source: string): WarmupUploadIngestionEvaluation {
    return {
      decision: 'NAO_UTILIZAR',
      reason: 'INVALID_WARMUP_UPLOAD_INPUT',
      source,
      values: [],
      metrics: EMPTY_METRICS,
      productionMoneyAllowed: false,
      activeSessionMutationAllowed: false,
      explanation:
        'Entrada inválida para ingestão de warmup. O sistema bloqueia a operação por segurança institucional.',
    };
  }
}
