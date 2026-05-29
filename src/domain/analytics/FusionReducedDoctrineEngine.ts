export type FusionReducedTriggerMode =
  | 'NO_CANDIDATE'
  | 'ABSENCE_RESEARCH'
  | 'DOMINANCE_RESEARCH'
  | 'DOMINANCE_PAPER';

export type FusionReducedEvidenceLevel =
  | 'INSUFFICIENT_SAMPLE'
  | 'LOW'
  | 'MODERATE'
  | 'HIGH';

export interface FusionReducedDoctrineOptions {
  readonly baseNumber?: number;
  readonly neighborRadius?: number;
  readonly maxHistorySize?: number;
  readonly minSampleSize?: number;
  readonly recentWindowSize?: number;
  readonly absenceThreshold?: number;
  readonly dominanceThreshold?: number;
  readonly paperThreshold?: number;
}

export interface FusionReducedCandidate {
  readonly triggerMode: FusionReducedTriggerMode;
  readonly targetNumbers: readonly number[];
  readonly candidateScore: number;
  readonly executionMode: 'NONE' | 'RESEARCH_ONLY' | 'PAPER_ONLY';
}

export interface FusionReducedDoctrineAnalysis {
  readonly sampleSize: number;
  readonly analyzedSize: number;
  readonly baseNumber: number;
  readonly neighborRadius: number;
  readonly regionNumbers: readonly number[];
  readonly recentWindowSize: number;
  readonly expectedHitRateScore: number;
  readonly historicalHitRateScore: number;
  readonly recentHitRateScore: number;
  readonly absenceStreak: number;
  readonly maxAbsenceStreak: number;
  readonly absenceScore: number;
  readonly dominanceScore: number;
  readonly stabilityScore: number;
  readonly regionPressureScore: number;
  readonly evidenceLevel: FusionReducedEvidenceLevel;
  readonly candidate: FusionReducedCandidate;
  readonly operationalGate: 'BLOCKED';
  readonly liveMoneyAuthorized: false;
  readonly rationale: readonly string[];
}

const EUROPEAN_WHEEL_ORDER: readonly number[] = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
  5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];

const DEFAULT_BASE_NUMBER = 23;
const DEFAULT_NEIGHBOR_RADIUS = 9;
const DEFAULT_MAX_HISTORY_SIZE = 200;
const DEFAULT_MIN_SAMPLE_SIZE = 100;
const DEFAULT_RECENT_WINDOW_SIZE = 40;
const DEFAULT_ABSENCE_THRESHOLD = 65;
const DEFAULT_DOMINANCE_THRESHOLD = 58;
const DEFAULT_PAPER_THRESHOLD = 74;

/**
 * Fusion Reduced Doctrine Engine.
 *
 * Builds a reduced wheel region around a base number using N neighbors to the
 * left and N neighbors to the right, then evaluates absence and dominance
 * triggers. Absence is treated more defensively because it can become chasing;
 * dominance receives stronger permission when supported by recent pressure and
 * stability.
 *
 * Complexity:
 * - Time: O(n), bounded by maxHistorySize.
 * - Space: O(r), where r is region size.
 */
export class FusionReducedDoctrineEngine {
  public analyze(
    history: readonly number[],
    options: FusionReducedDoctrineOptions = {},
  ): FusionReducedDoctrineAnalysis {
    const baseNumber = this.validRouletteNumberOrDefault(options.baseNumber, DEFAULT_BASE_NUMBER);
    const neighborRadius = this.positiveIntegerOrDefault(options.neighborRadius, DEFAULT_NEIGHBOR_RADIUS);
    const maxHistorySize = this.positiveIntegerOrDefault(options.maxHistorySize, DEFAULT_MAX_HISTORY_SIZE);
    const minSampleSize = this.positiveIntegerOrDefault(options.minSampleSize, DEFAULT_MIN_SAMPLE_SIZE);
    const recentWindowSize = this.positiveIntegerOrDefault(options.recentWindowSize, DEFAULT_RECENT_WINDOW_SIZE);
    const absenceThreshold = this.clampScore(
      this.positiveIntegerOrDefault(options.absenceThreshold, DEFAULT_ABSENCE_THRESHOLD),
    );
    const dominanceThreshold = this.clampScore(
      this.positiveIntegerOrDefault(options.dominanceThreshold, DEFAULT_DOMINANCE_THRESHOLD),
    );
    const paperThreshold = this.clampScore(
      this.positiveIntegerOrDefault(options.paperThreshold, DEFAULT_PAPER_THRESHOLD),
    );

    const normalizedHistory = this.normalizeHistory(history, maxHistorySize);
    const regionNumbers = this.buildRegion(baseNumber, neighborRadius);
    const regionSet = new Set(regionNumbers);
    const expectedHitRateScore = this.clampScore(Math.round((regionNumbers.length / 37) * 100));

    if (normalizedHistory.length < minSampleSize) {
      return this.analysis(
        history.length,
        normalizedHistory.length,
        baseNumber,
        neighborRadius,
        regionNumbers,
        Math.min(recentWindowSize, normalizedHistory.length),
        expectedHitRateScore,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        'INSUFFICIENT_SAMPLE',
        this.emptyCandidate('NO_CANDIDATE', regionNumbers),
        [
          'Amostra insuficiente para avaliar Fusion Reduzida.',
          'Gate financeiro permanece bloqueado.',
        ],
      );
    }

    const recentWindow = normalizedHistory.slice(Math.max(0, normalizedHistory.length - recentWindowSize));
    const historicalHits = this.countHits(normalizedHistory, regionSet);
    const recentHits = this.countHits(recentWindow, regionSet);

    const historicalHitRateScore = this.clampScore(Math.round((historicalHits / normalizedHistory.length) * 100));
    const recentHitRateScore = this.clampScore(Math.round((recentHits / Math.max(1, recentWindow.length)) * 100));
    const absenceStreak = this.calculateCurrentAbsenceStreak(normalizedHistory, regionSet);
    const maxAbsenceStreak = this.calculateMaxAbsenceStreak(normalizedHistory, regionSet);
    const absenceScore = this.calculateAbsenceScore(absenceStreak, expectedHitRateScore);
    const dominanceScore = this.calculateDominanceScore(historicalHitRateScore, recentHitRateScore, expectedHitRateScore);
    const stabilityScore = this.calculateStabilityScore(normalizedHistory, regionSet, recentWindowSize);
    const regionPressureScore = this.clampScore(
      Math.round(
        (dominanceScore * 0.40)
        + (absenceScore * 0.20)
        + (stabilityScore * 0.20)
        + (recentHitRateScore * 0.20),
      ),
    );
    const evidenceLevel = this.classifyEvidence(regionPressureScore, dominanceScore, absenceScore, stabilityScore);
    const candidate = this.buildCandidate(
      regionNumbers,
      absenceScore,
      dominanceScore,
      regionPressureScore,
      evidenceLevel,
      absenceThreshold,
      dominanceThreshold,
      paperThreshold,
    );

    return this.analysis(
      history.length,
      normalizedHistory.length,
      baseNumber,
      neighborRadius,
      regionNumbers,
      recentWindow.length,
      expectedHitRateScore,
      historicalHitRateScore,
      recentHitRateScore,
      absenceStreak,
      maxAbsenceStreak,
      absenceScore,
      dominanceScore,
      stabilityScore,
      regionPressureScore,
      evidenceLevel,
      candidate,
      [
        'Fusion Reduzida calculada por região de roda ao redor do número-base.',
        'O engine avalia ausência e dominância, deixando o gatilho mais forte prevalecer defensivamente.',
        'Ausência gera apenas pesquisa por padrão; dominância pode gerar paper quando evidência e estabilidade forem suficientes.',
        'Nenhum candidato autoriza live money.',
        'Gate financeiro permanece bloqueado por desenho arquitetural.',
      ],
    );
  }

  private buildRegion(baseNumber: number, radius: number): readonly number[] {
    const baseIndex = EUROPEAN_WHEEL_ORDER.indexOf(baseNumber);

    if (baseIndex < 0) {
      return [DEFAULT_BASE_NUMBER];
    }

    const region: number[] = [];
    const wheelSize = EUROPEAN_WHEEL_ORDER.length;

    for (let offset = -radius; offset <= radius; offset += 1) {
      const index = (baseIndex + offset + wheelSize) % wheelSize;
      region.push(EUROPEAN_WHEEL_ORDER[index]);
    }

    return region;
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

    return normalized;
  }

  private countHits(values: readonly number[], regionSet: ReadonlySet<number>): number {
    let hits = 0;

    for (const value of values) {
      if (regionSet.has(value)) {
        hits += 1;
      }
    }

    return hits;
  }

  private calculateCurrentAbsenceStreak(
    history: readonly number[],
    regionSet: ReadonlySet<number>,
  ): number {
    let streak = 0;

    for (let index = history.length - 1; index >= 0; index -= 1) {
      if (regionSet.has(history[index])) {
        break;
      }

      streak += 1;
    }

    return streak;
  }

  private calculateMaxAbsenceStreak(
    history: readonly number[],
    regionSet: ReadonlySet<number>,
  ): number {
    let maxStreak = 0;
    let currentStreak = 0;

    for (const value of history) {
      if (regionSet.has(value)) {
        maxStreak = Math.max(maxStreak, currentStreak);
        currentStreak = 0;
      } else {
        currentStreak += 1;
      }
    }

    return Math.max(maxStreak, currentStreak);
  }

  private calculateAbsenceScore(absenceStreak: number, expectedHitRateScore: number): number {
    const expectedMissRate = Math.max(1, 100 - expectedHitRateScore);
    return this.clampScore(Math.round((absenceStreak / expectedMissRate) * 100));
  }

  private calculateDominanceScore(
    historicalHitRateScore: number,
    recentHitRateScore: number,
    expectedHitRateScore: number,
  ): number {
    const historicalEdge = Math.max(0, historicalHitRateScore - expectedHitRateScore);
    const recentEdge = Math.max(0, recentHitRateScore - expectedHitRateScore);

    return this.clampScore(
      Math.round((historicalEdge * 0.45) + (recentEdge * 0.55) + 50),
    );
  }

  private calculateStabilityScore(
    history: readonly number[],
    regionSet: ReadonlySet<number>,
    windowSize: number,
  ): number {
    if (history.length < windowSize * 2) {
      return 50;
    }

    const recent = history.slice(history.length - windowSize);
    const previous = history.slice(history.length - (windowSize * 2), history.length - windowSize);
    const recentRate = this.countHits(recent, regionSet) / windowSize;
    const previousRate = this.countHits(previous, regionSet) / windowSize;
    const delta = Math.abs(recentRate - previousRate);

    return this.clampScore(Math.round(100 - (delta * 100)));
  }

  private classifyEvidence(
    regionPressureScore: number,
    dominanceScore: number,
    absenceScore: number,
    stabilityScore: number,
  ): FusionReducedEvidenceLevel {
    if (regionPressureScore >= 75 && dominanceScore >= 65 && stabilityScore >= 60) {
      return 'HIGH';
    }

    if (regionPressureScore >= 55 && (dominanceScore >= 55 || absenceScore >= 65) && stabilityScore >= 45) {
      return 'MODERATE';
    }

    return 'LOW';
  }

  private buildCandidate(
    regionNumbers: readonly number[],
    absenceScore: number,
    dominanceScore: number,
    regionPressureScore: number,
    evidenceLevel: FusionReducedEvidenceLevel,
    absenceThreshold: number,
    dominanceThreshold: number,
    paperThreshold: number,
  ): FusionReducedCandidate {
    if (dominanceScore >= dominanceThreshold && regionPressureScore >= paperThreshold && evidenceLevel !== 'LOW') {
      return {
        triggerMode: 'DOMINANCE_PAPER',
        targetNumbers: regionNumbers,
        candidateScore: regionPressureScore,
        executionMode: 'PAPER_ONLY',
      };
    }

    if (dominanceScore >= dominanceThreshold && evidenceLevel !== 'LOW') {
      return {
        triggerMode: 'DOMINANCE_RESEARCH',
        targetNumbers: regionNumbers,
        candidateScore: regionPressureScore,
        executionMode: 'RESEARCH_ONLY',
      };
    }

    if (absenceScore >= absenceThreshold) {
      return {
        triggerMode: 'ABSENCE_RESEARCH',
        targetNumbers: regionNumbers,
        candidateScore: this.clampScore(Math.round((absenceScore * 0.70) + (regionPressureScore * 0.30))),
        executionMode: 'RESEARCH_ONLY',
      };
    }

    return this.emptyCandidate('NO_CANDIDATE', regionNumbers);
  }

  private emptyCandidate(
    triggerMode: FusionReducedTriggerMode,
    regionNumbers: readonly number[],
  ): FusionReducedCandidate {
    return {
      triggerMode,
      targetNumbers: triggerMode === 'NO_CANDIDATE' ? [] : regionNumbers,
      candidateScore: 0,
      executionMode: 'NONE',
    };
  }

  private analysis(
    sampleSize: number,
    analyzedSize: number,
    baseNumber: number,
    neighborRadius: number,
    regionNumbers: readonly number[],
    recentWindowSize: number,
    expectedHitRateScore: number,
    historicalHitRateScore: number,
    recentHitRateScore: number,
    absenceStreak: number,
    maxAbsenceStreak: number,
    absenceScore: number,
    dominanceScore: number,
    stabilityScore: number,
    regionPressureScore: number,
    evidenceLevel: FusionReducedEvidenceLevel,
    candidate: FusionReducedCandidate,
    rationale: readonly string[],
  ): FusionReducedDoctrineAnalysis {
    return {
      sampleSize,
      analyzedSize,
      baseNumber,
      neighborRadius,
      regionNumbers,
      recentWindowSize,
      expectedHitRateScore,
      historicalHitRateScore,
      recentHitRateScore,
      absenceStreak,
      maxAbsenceStreak,
      absenceScore,
      dominanceScore,
      stabilityScore,
      regionPressureScore,
      evidenceLevel,
      candidate,
      operationalGate: 'BLOCKED',
      liveMoneyAuthorized: false,
      rationale,
    };
  }

  private validRouletteNumberOrDefault(value: number | undefined, fallback: number): number {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 36) {
      return fallback;
    }

    return value;
  }

  private positiveIntegerOrDefault(value: number | undefined, fallback: number): number {
    if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
      return fallback;
    }

    return value;
  }

  private clampScore(value: number): number {
    if (!Number.isFinite(value)) {
      return 0;
    }

    if (value < 0) {
      return 0;
    }

    if (value > 100) {
      return 100;
    }

    return Math.round(value);
  }
}
