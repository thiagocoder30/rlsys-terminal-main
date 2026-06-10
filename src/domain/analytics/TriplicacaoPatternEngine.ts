export type TriplicacaoPatternKind =
  | 'TC'
  | 'NTC'
  | 'TA'
  | 'NTA'
  | 'ZERO_DISCARDED'
  | 'INSUFFICIENT_DATA';

export type TriplicacaoEnginePatternKind = Exclude<
  TriplicacaoPatternKind,
  'ZERO_DISCARDED' | 'INSUFFICIENT_DATA'
>;

export type TriplicacaoColor = 'RED' | 'BLACK';

export interface TriplicacaoTrio {
  readonly sourceIndexes: readonly [number, number, number];
  readonly numbers: readonly [number, number, number];
  readonly colors: readonly [TriplicacaoColor, TriplicacaoColor, TriplicacaoColor];
  readonly patternKind: TriplicacaoEnginePatternKind;
}

export interface TriplicacaoRuntimeSignal {
  readonly patternKind: TriplicacaoPatternKind;
  readonly confidenceScore: number;
  readonly riskScore: number;
  readonly reasons: readonly string[];
  readonly warnings: readonly string[];
  readonly blockers: readonly string[];
}

export interface TriplicacaoPatternSummary {
  readonly patternKind: TriplicacaoEnginePatternKind;
  readonly count: number;
  readonly frequencyScore: number;
  readonly recentCount: number;
  readonly recentFrequencyScore: number;
}

export interface TriplicacaoPatternEngineOptions {
  readonly maxHistorySize?: number;
  readonly minValidTrios?: number;
  readonly recentTrioWindow?: number;
  readonly dominanceThreshold?: number;
  readonly paperConfidenceThreshold?: number;
  readonly paperRiskThreshold?: number;
}

export interface TriplicacaoPatternAnalysis {
  readonly sampleSize: number;
  readonly analyzedSize: number;
  readonly validTrioCount: number;
  readonly discardedZeroTrioCount: number;
  readonly minValidTrios: number;
  readonly recentTrioWindow: number;
  readonly trios: readonly TriplicacaoTrio[];
  readonly summaries: readonly TriplicacaoPatternSummary[];
  readonly dominantPatternKind: TriplicacaoPatternKind;
  readonly dominantFrequencyScore: number;
  readonly dominantRecentFrequencyScore: number;
  readonly persistenceScore: number;
  readonly volatilityScore: number;
  readonly confidenceScore: number;
  readonly riskScore: number;
  readonly signal: TriplicacaoRuntimeSignal;
  readonly operationalMode: 'OBSERVE' | 'PAPER_ONLY';
  readonly liveMoneyAuthorized: false;
  readonly rationale: readonly string[];
}

const RED_NUMBERS = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

const BLACK_NUMBERS = new Set([
  2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35,
]);

const PATTERNS: readonly TriplicacaoEnginePatternKind[] = ['TC', 'NTC', 'TA', 'NTA'];

export class TriplicacaoPatternEngine {
  public analyze(
    history: readonly number[],
    options: TriplicacaoPatternEngineOptions = {},
  ): TriplicacaoPatternAnalysis {
    const maxHistorySize = this.positiveIntegerOrDefault(options.maxHistorySize, 200);
    const minValidTrios = this.positiveIntegerOrDefault(options.minValidTrios, 12);
    const recentTrioWindow = this.positiveIntegerOrDefault(options.recentTrioWindow, 8);
    const dominanceThreshold = this.clampScore(
      this.positiveIntegerOrDefault(options.dominanceThreshold, 58),
    );
    const paperConfidenceThreshold = this.clampRatio(
      typeof options.paperConfidenceThreshold === 'number' ? options.paperConfidenceThreshold : 0.7,
    );
    const paperRiskThreshold = this.clampRatio(
      typeof options.paperRiskThreshold === 'number' ? options.paperRiskThreshold : 0.33,
    );

    const analyzedHistory = this.normalizeHistory(history, maxHistorySize);
    const built = this.buildTrios(analyzedHistory);
    const summaries = this.summarize(built.validTrios, recentTrioWindow);

    if (built.validTrios.length < minValidTrios) {
      const patternKind: TriplicacaoPatternKind =
        built.discardedZeroTrioCount > 0 ? 'ZERO_DISCARDED' : 'INSUFFICIENT_DATA';

      return this.compose({
        sampleSize: history.length,
        analyzedSize: analyzedHistory.length,
        validTrios: built.validTrios,
        discardedZeroTrioCount: built.discardedZeroTrioCount,
        minValidTrios,
        recentTrioWindow,
        summaries,
        dominantPatternKind: patternKind,
        dominantFrequencyScore: 0,
        dominantRecentFrequencyScore: 0,
        persistenceScore: 0,
        volatilityScore: 100,
        confidenceScore: 0,
        riskScore: 0.6,
        operationalMode: 'OBSERVE',
        reasons: ['TRIPLICACAO_SAMPLE_INSUFFICIENT'],
        warnings: built.discardedZeroTrioCount > 0 ? ['TRIOS_WITH_ZERO_DISCARDED'] : ['AWAIT_MORE_TRIOS'],
        blockers: ['TRIPLICACAO_DADOS_INSUFICIENTES'],
      });
    }

    const dominant = this.pickDominant(summaries);
    const persistenceScore = this.persistence(built.validTrios, dominant.patternKind);
    const volatilityScore = this.volatility(
      dominant.frequencyScore,
      dominant.recentFrequencyScore,
      persistenceScore,
    );
    const confidenceScore = this.confidence(
      dominant.frequencyScore,
      dominant.recentFrequencyScore,
      persistenceScore,
      volatilityScore,
    );
    const riskScore = this.risk(confidenceScore, volatilityScore, dominant.recentFrequencyScore);

    const operationalMode =
      dominant.frequencyScore >= dominanceThreshold &&
      confidenceScore >= paperConfidenceThreshold &&
      riskScore <= paperRiskThreshold
        ? 'PAPER_ONLY'
        : 'OBSERVE';

    return this.compose({
      sampleSize: history.length,
      analyzedSize: analyzedHistory.length,
      validTrios: built.validTrios,
      discardedZeroTrioCount: built.discardedZeroTrioCount,
      minValidTrios,
      recentTrioWindow,
      summaries,
      dominantPatternKind: dominant.patternKind,
      dominantFrequencyScore: dominant.frequencyScore,
      dominantRecentFrequencyScore: dominant.recentFrequencyScore,
      persistenceScore,
      volatilityScore,
      confidenceScore,
      riskScore,
      operationalMode,
      reasons: [
        `TRIPLICACAO_DOMINANT_PATTERN:${dominant.patternKind}`,
        `DOMINANT_FREQUENCY:${dominant.frequencyScore}`,
        `RECENT_FREQUENCY:${dominant.recentFrequencyScore}`,
        `PERSISTENCE:${persistenceScore}`,
      ],
      warnings: built.discardedZeroTrioCount > 0 ? ['TRIOS_WITH_ZERO_DISCARDED'] : [],
      blockers: operationalMode === 'PAPER_ONLY' ? [] : ['TRIPLICACAO_SEM_EVIDENCIA_FORTE'],
    });
  }

  private normalizeHistory(history: readonly number[], maxHistorySize: number): readonly number[] {
    const startIndex = Math.max(0, history.length - maxHistorySize);
    const normalized: number[] = [];

    for (let index = startIndex; index < history.length; index += 1) {
      const value = history[index];

      if (Number.isInteger(value) && value >= 0 && value <= 36) {
        normalized.push(value);
      }
    }

    return Object.freeze(normalized);
  }

  private buildTrios(history: readonly number[]): {
    readonly validTrios: readonly TriplicacaoTrio[];
    readonly discardedZeroTrioCount: number;
  } {
    const validTrios: TriplicacaoTrio[] = [];
    let discardedZeroTrioCount = 0;

    for (let index = 0; index + 2 < history.length; index += 3) {
      const first = history[index];
      const second = history[index + 1];
      const third = history[index + 2];

      if (first === 0 || second === 0 || third === 0) {
        discardedZeroTrioCount += 1;
        continue;
      }

      const firstColor = this.color(first);
      const secondColor = this.color(second);
      const thirdColor = this.color(third);

      if (firstColor === null || secondColor === null || thirdColor === null) {
        continue;
      }

      validTrios.push(Object.freeze({
        sourceIndexes: Object.freeze([index, index + 1, index + 2]) as readonly [number, number, number],
        numbers: Object.freeze([first, second, third]) as readonly [number, number, number],
        colors: Object.freeze([firstColor, secondColor, thirdColor]) as readonly [TriplicacaoColor, TriplicacaoColor, TriplicacaoColor],
        patternKind: this.classify(firstColor, secondColor, thirdColor),
      }));
    }

    return Object.freeze({
      validTrios: Object.freeze(validTrios),
      discardedZeroTrioCount,
    });
  }

  private classify(
    first: TriplicacaoColor,
    second: TriplicacaoColor,
    third: TriplicacaoColor,
  ): TriplicacaoEnginePatternKind {
    if (first === second && second === third) {
      return 'TC';
    }

    if (first === second && second !== third) {
      return 'NTC';
    }

    if (first !== second && first === third) {
      return 'TA';
    }

    return 'NTA';
  }

  private summarize(
    trios: readonly TriplicacaoTrio[],
    recentTrioWindow: number,
  ): readonly TriplicacaoPatternSummary[] {
    const recentTrios = trios.slice(Math.max(0, trios.length - recentTrioWindow));

    return Object.freeze(PATTERNS.map((patternKind) => {
      const count = trios.filter((trio) => trio.patternKind === patternKind).length;
      const recentCount = recentTrios.filter((trio) => trio.patternKind === patternKind).length;

      return Object.freeze({
        patternKind,
        count,
        frequencyScore: this.clampScore(Math.round((count / Math.max(1, trios.length)) * 100)),
        recentCount,
        recentFrequencyScore: this.clampScore(Math.round((recentCount / Math.max(1, recentTrios.length)) * 100)),
      });
    }));
  }

  private pickDominant(summaries: readonly TriplicacaoPatternSummary[]): TriplicacaoPatternSummary {
    return summaries.reduce((best, current) => {
      if (current.frequencyScore > best.frequencyScore) {
        return current;
      }

      if (
        current.frequencyScore === best.frequencyScore &&
        current.recentFrequencyScore > best.recentFrequencyScore
      ) {
        return current;
      }

      return best;
    }, summaries[0]);
  }

  private persistence(
    trios: readonly TriplicacaoTrio[],
    patternKind: TriplicacaoEnginePatternKind,
  ): number {
    let current = 0;
    let max = 0;

    for (const trio of trios) {
      if (trio.patternKind === patternKind) {
        current += 1;
        max = Math.max(max, current);
      } else {
        current = 0;
      }
    }

    return this.clampScore(Math.round((max / Math.max(1, trios.length)) * 100));
  }

  private volatility(frequency: number, recent: number, persistence: number): number {
    return this.clampScore(Math.round((Math.abs(frequency - recent) * 0.55) + ((100 - persistence) * 0.45)));
  }

  private confidence(frequency: number, recent: number, persistence: number, volatility: number): number {
    return this.clampRatio(
      ((frequency * 0.35) + (recent * 0.35) + (persistence * 0.2) + ((100 - volatility) * 0.1)) / 100,
    );
  }

  private risk(confidence: number, volatility: number, recent: number): number {
    return this.clampRatio(
      ((1 - confidence) * 0.55) + ((volatility / 100) * 0.3) + (((100 - recent) / 100) * 0.15),
    );
  }

  private compose(input: {
    readonly sampleSize: number;
    readonly analyzedSize: number;
    readonly validTrios: readonly TriplicacaoTrio[];
    readonly discardedZeroTrioCount: number;
    readonly minValidTrios: number;
    readonly recentTrioWindow: number;
    readonly summaries: readonly TriplicacaoPatternSummary[];
    readonly dominantPatternKind: TriplicacaoPatternKind;
    readonly dominantFrequencyScore: number;
    readonly dominantRecentFrequencyScore: number;
    readonly persistenceScore: number;
    readonly volatilityScore: number;
    readonly confidenceScore: number;
    readonly riskScore: number;
    readonly operationalMode: 'OBSERVE' | 'PAPER_ONLY';
    readonly reasons: readonly string[];
    readonly warnings: readonly string[];
    readonly blockers: readonly string[];
  }): TriplicacaoPatternAnalysis {
    return Object.freeze({
      sampleSize: input.sampleSize,
      analyzedSize: input.analyzedSize,
      validTrioCount: input.validTrios.length,
      discardedZeroTrioCount: input.discardedZeroTrioCount,
      minValidTrios: input.minValidTrios,
      recentTrioWindow: input.recentTrioWindow,
      trios: Object.freeze([...input.validTrios]),
      summaries: Object.freeze([...input.summaries]),
      dominantPatternKind: input.dominantPatternKind,
      dominantFrequencyScore: input.dominantFrequencyScore,
      dominantRecentFrequencyScore: input.dominantRecentFrequencyScore,
      persistenceScore: input.persistenceScore,
      volatilityScore: input.volatilityScore,
      confidenceScore: input.confidenceScore,
      riskScore: input.riskScore,
      signal: Object.freeze({
        patternKind: input.dominantPatternKind,
        confidenceScore: input.confidenceScore,
        riskScore: input.riskScore,
        reasons: Object.freeze([...input.reasons]),
        warnings: Object.freeze([...input.warnings]),
        blockers: Object.freeze([...input.blockers]),
      }),
      operationalMode: input.operationalMode,
      liveMoneyAuthorized: false,
      rationale: Object.freeze([
        'Triplicação calculada por trios de cores sem zero.',
        'TC: três cores iguais.',
        'NTC: início e confirmação iguais, finalização diferente.',
        'TA: início e finalização iguais, confirmação diferente.',
        'NTA: confirmação e finalização iguais, início diferente.',
        'Nenhum sinal autoriza dinheiro real.',
      ]),
    });
  }

  private color(value: number): TriplicacaoColor | null {
    if (RED_NUMBERS.has(value)) {
      return 'RED';
    }

    if (BLACK_NUMBERS.has(value)) {
      return 'BLACK';
    }

    return null;
  }

  private positiveIntegerOrDefault(value: number | undefined, fallback: number): number {
    return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : fallback;
  }

  private clampScore(value: number): number {
    if (!Number.isFinite(value)) {
      return 0;
    }

    return Math.max(0, Math.min(100, Math.round(value)));
  }

  private clampRatio(value: number): number {
    if (!Number.isFinite(value)) {
      return 0;
    }

    return Math.round(Math.max(0, Math.min(1, value)) * 1000) / 1000;
  }
}
