import {
  TriplicacaoPatternEngine,
  type TriplicacaoEnginePatternKind,
  type TriplicacaoPatternAnalysis,
  type TriplicacaoTrio,
} from './TriplicacaoPatternEngine.js';

export interface TriplicacaoAdvancedProbabilityOptions {
  readonly maxHistorySize?: number;
  readonly minValidTrios?: number;
  readonly recentTrioWindow?: number;
  readonly shortWindow?: number;
  readonly mediumWindow?: number;
  readonly longWindow?: number;
  readonly dominanceThreshold?: number;
  readonly paperConfidenceThreshold?: number;
  readonly paperRiskThreshold?: number;
}

export interface TriplicacaoRecurrenceMetrics {
  readonly patternKind: TriplicacaoEnginePatternKind;
  readonly occurrences: number;
  readonly expectedOccurrences: number;
  readonly expectedFrequencyScore: number;
  readonly observedFrequencyScore: number;
  readonly shortWindowFrequencyScore: number;
  readonly mediumWindowFrequencyScore: number;
  readonly longWindowFrequencyScore: number;
  readonly lastSeenDistance: number | null;
  readonly averageInterval: number | null;
  readonly maxAbsenceInterval: number | null;
  readonly absenceScore: number;
  readonly recurrenceScore: number;
  readonly zScore: number;
  readonly conditionalContinuationScore: number;
  readonly conditionalReversalScore: number;
  readonly temporalDecayScore: number;
  readonly evidenceScore: number;
}

export interface TriplicacaoConsensusInput {
  readonly strategyId: string;
  readonly confidenceScore: number;
  readonly riskScore: number;
  readonly blockers?: readonly string[];
  readonly warnings?: readonly string[];
  readonly reasons?: readonly string[];
}

export interface TriplicacaoStrategyConsensus {
  readonly inputCount: number;
  readonly acceptedInputCount: number;
  readonly consensusScore: number;
  readonly consensusRiskScore: number;
  readonly agreementLevel: 'NONE' | 'WEAK' | 'MODERATE' | 'STRONG';
  readonly operationalMode: 'OBSERVE' | 'PAPER_ONLY';
  readonly liveMoneyAuthorized: false;
  readonly reasons: readonly string[];
  readonly warnings: readonly string[];
  readonly blockers: readonly string[];
}

export interface TriplicacaoAdvancedProbabilityAnalysis {
  readonly baseAnalysis: TriplicacaoPatternAnalysis;
  readonly metrics: readonly TriplicacaoRecurrenceMetrics[];
  readonly selectedPatternKind: TriplicacaoEnginePatternKind | null;
  readonly advancedEvidenceScore: number;
  readonly advancedConfidenceScore: number;
  readonly advancedRiskScore: number;
  readonly probabilityMode: 'INSUFFICIENT_DATA' | 'OBSERVE' | 'PAPER_ONLY';
  readonly liveMoneyAuthorized: false;
  readonly reasons: readonly string[];
  readonly warnings: readonly string[];
  readonly blockers: readonly string[];
}

const PATTERNS: readonly TriplicacaoEnginePatternKind[] = ['TC', 'NTC', 'TA', 'NTA'];
const EXPECTED_PATTERN_PROBABILITY = 0.25;

export class TriplicacaoAdvancedProbabilityEngine {
  private readonly baseEngine: TriplicacaoPatternEngine;

  public constructor(baseEngine: TriplicacaoPatternEngine = new TriplicacaoPatternEngine()) {
    this.baseEngine = baseEngine;
  }

  public analyze(
    history: readonly number[],
    options: TriplicacaoAdvancedProbabilityOptions = {},
  ): TriplicacaoAdvancedProbabilityAnalysis {
    const shortWindow = this.positiveIntegerOrDefault(options.shortWindow, 6);
    const mediumWindow = this.positiveIntegerOrDefault(options.mediumWindow, 12);
    const longWindow = this.positiveIntegerOrDefault(options.longWindow, 24);

    const baseAnalysis = this.baseEngine.analyze(history, {
      maxHistorySize: options.maxHistorySize,
      minValidTrios: options.minValidTrios,
      recentTrioWindow: options.recentTrioWindow,
      dominanceThreshold: options.dominanceThreshold,
      paperConfidenceThreshold: options.paperConfidenceThreshold,
      paperRiskThreshold: options.paperRiskThreshold,
    });

    const metrics = this.calculateMetrics(baseAnalysis.trios, shortWindow, mediumWindow, longWindow);

    if (baseAnalysis.validTrioCount < baseAnalysis.minValidTrios) {
      return Object.freeze({
        baseAnalysis,
        metrics,
        selectedPatternKind: null,
        advancedEvidenceScore: 0,
        advancedConfidenceScore: 0,
        advancedRiskScore: 0.75,
        probabilityMode: 'INSUFFICIENT_DATA',
        liveMoneyAuthorized: false,
        reasons: Object.freeze(['TRIPLICACAO_ADVANCED_SAMPLE_INSUFFICIENT', ...baseAnalysis.signal.reasons]),
        warnings: Object.freeze([...baseAnalysis.signal.warnings]),
        blockers: Object.freeze(['TRIPLICACAO_ADVANCED_DADOS_INSUFICIENTES', ...baseAnalysis.signal.blockers]),
      });
    }

    const selectedMetric = this.pickMetric(metrics);
    const advancedEvidenceScore = selectedMetric?.evidenceScore ?? 0;
    const advancedConfidenceScore = this.calculateAdvancedConfidence(baseAnalysis, selectedMetric);
    const advancedRiskScore = this.calculateAdvancedRisk(baseAnalysis, selectedMetric, advancedConfidenceScore);

    const probabilityMode =
      selectedMetric !== null &&
      advancedEvidenceScore >= 68 &&
      advancedConfidenceScore >= 0.72 &&
      advancedRiskScore <= 0.34 &&
      baseAnalysis.operationalMode === 'PAPER_ONLY'
        ? 'PAPER_ONLY'
        : 'OBSERVE';

    return Object.freeze({
      baseAnalysis,
      metrics,
      selectedPatternKind: selectedMetric?.patternKind ?? null,
      advancedEvidenceScore,
      advancedConfidenceScore,
      advancedRiskScore,
      probabilityMode,
      liveMoneyAuthorized: false,
      reasons: Object.freeze([
        selectedMetric === null ? 'TRIPLICACAO_ADVANCED_NO_PATTERN' : `TRIPLICACAO_ADVANCED_SELECTED:${selectedMetric.patternKind}`,
        `ADVANCED_EVIDENCE:${advancedEvidenceScore}`,
        `ADVANCED_CONFIDENCE:${advancedConfidenceScore}`,
        `ADVANCED_RISK:${advancedRiskScore}`,
      ]),
      warnings: Object.freeze([
        ...baseAnalysis.signal.warnings,
        ...(probabilityMode === 'PAPER_ONLY' ? [] : ['TRIPLICACAO_ADVANCED_OBSERVE_ONLY']),
      ]),
      blockers: Object.freeze(probabilityMode === 'PAPER_ONLY' ? [] : ['TRIPLICACAO_ADVANCED_EVIDENCIA_INSUFICIENTE']),
    });
  }

  public composeConsensus(inputs: readonly TriplicacaoConsensusInput[]): TriplicacaoStrategyConsensus {
    const acceptedInputs = inputs.filter((input) => {
      const blockers = input.blockers ?? [];
      return blockers.length === 0 && input.confidenceScore > 0 && input.riskScore >= 0;
    });

    if (acceptedInputs.length === 0) {
      return Object.freeze({
        inputCount: inputs.length,
        acceptedInputCount: 0,
        consensusScore: 0,
        consensusRiskScore: 1,
        agreementLevel: 'NONE',
        operationalMode: 'OBSERVE',
        liveMoneyAuthorized: false,
        reasons: Object.freeze(['CONSENSUS_NO_ACCEPTED_INPUTS']),
        warnings: Object.freeze(this.collectWarnings(inputs)),
        blockers: Object.freeze(['CONSENSUS_BLOCKED']),
      });
    }

    const confidenceAverage = acceptedInputs.reduce((sum, input) => sum + this.clampRatio(input.confidenceScore), 0) / acceptedInputs.length;
    const riskAverage = acceptedInputs.reduce((sum, input) => sum + this.clampRatio(input.riskScore), 0) / acceptedInputs.length;
    const participationScore = acceptedInputs.length / Math.max(1, inputs.length);
    const consensusScore = this.clampScore(Math.round(confidenceAverage * 100 * participationScore));
    const consensusRiskScore = this.clampRatio(riskAverage + ((1 - participationScore) * 0.2));
    const agreementLevel = this.agreementLevel(consensusScore);

    const operationalMode =
      acceptedInputs.length >= 2 &&
      consensusScore >= 70 &&
      consensusRiskScore <= 0.35
        ? 'PAPER_ONLY'
        : 'OBSERVE';

    return Object.freeze({
      inputCount: inputs.length,
      acceptedInputCount: acceptedInputs.length,
      consensusScore,
      consensusRiskScore,
      agreementLevel,
      operationalMode,
      liveMoneyAuthorized: false,
      reasons: Object.freeze([
        `CONSENSUS_ACCEPTED_INPUTS:${acceptedInputs.length}`,
        `CONSENSUS_SCORE:${consensusScore}`,
        `CONSENSUS_RISK:${consensusRiskScore}`,
      ]),
      warnings: Object.freeze(this.collectWarnings(inputs)),
      blockers: Object.freeze(operationalMode === 'PAPER_ONLY' ? [] : ['CONSENSUS_OBSERVE_ONLY']),
    });
  }

  private calculateMetrics(
    trios: readonly TriplicacaoTrio[],
    shortWindow: number,
    mediumWindow: number,
    longWindow: number,
  ): readonly TriplicacaoRecurrenceMetrics[] {
    return Object.freeze(PATTERNS.map((patternKind) => {
      const positions = this.positionsOf(trios, patternKind);
      const occurrences = positions.length;
      const expectedOccurrences = trios.length * EXPECTED_PATTERN_PROBABILITY;
      const observedFrequencyScore = this.frequency(occurrences, trios.length);
      const shortWindowFrequencyScore = this.windowFrequency(trios, patternKind, shortWindow);
      const mediumWindowFrequencyScore = this.windowFrequency(trios, patternKind, mediumWindow);
      const longWindowFrequencyScore = this.windowFrequency(trios, patternKind, longWindow);
      const lastSeenDistance = this.lastSeenDistance(trios.length, positions);
      const intervals = this.intervals(positions);
      const averageInterval = this.average(intervals);
      const maxAbsenceInterval = this.maxAbsence(trios.length, positions, intervals);
      const absenceScore = this.absenceScore(lastSeenDistance, averageInterval, trios.length);
      const recurrenceScore = this.recurrenceScore(intervals, occurrences, trios.length);
      const zScore = this.zScore(occurrences, trios.length);
      const conditionalContinuationScore = this.conditionalScore(trios, patternKind, true);
      const conditionalReversalScore = this.conditionalScore(trios, patternKind, false);
      const temporalDecayScore = this.temporalDecayScore(shortWindowFrequencyScore, mediumWindowFrequencyScore, longWindowFrequencyScore);
      const evidenceScore = this.evidenceScore({
        observedFrequencyScore,
        shortWindowFrequencyScore,
        mediumWindowFrequencyScore,
        longWindowFrequencyScore,
        absenceScore,
        recurrenceScore,
        zScore,
        conditionalContinuationScore,
        temporalDecayScore,
      });

      return Object.freeze({
        patternKind,
        occurrences,
        expectedOccurrences: this.round3(expectedOccurrences),
        expectedFrequencyScore: 25,
        observedFrequencyScore,
        shortWindowFrequencyScore,
        mediumWindowFrequencyScore,
        longWindowFrequencyScore,
        lastSeenDistance,
        averageInterval,
        maxAbsenceInterval,
        absenceScore,
        recurrenceScore,
        zScore,
        conditionalContinuationScore,
        conditionalReversalScore,
        temporalDecayScore,
        evidenceScore,
      });
    }));
  }

  private positionsOf(trios: readonly TriplicacaoTrio[], patternKind: TriplicacaoEnginePatternKind): readonly number[] {
    const positions: number[] = [];
    for (let index = 0; index < trios.length; index += 1) {
      if (trios[index].patternKind === patternKind) positions.push(index);
    }
    return Object.freeze(positions);
  }

  private intervals(positions: readonly number[]): readonly number[] {
    if (positions.length < 2) return Object.freeze([]);
    const intervals: number[] = [];
    for (let index = 1; index < positions.length; index += 1) intervals.push(positions[index] - positions[index - 1]);
    return Object.freeze(intervals);
  }

  private average(values: readonly number[]): number | null {
    if (values.length === 0) return null;
    return this.round3(values.reduce((sum, value) => sum + value, 0) / values.length);
  }

  private maxAbsence(total: number, positions: readonly number[], intervals: readonly number[]): number | null {
    if (positions.length === 0) return total;
    const headAbsence = positions[0];
    const tailAbsence = total - 1 - positions[positions.length - 1];
    const intervalAbsence = intervals.length === 0 ? 0 : Math.max(...intervals) - 1;
    return Math.max(headAbsence, tailAbsence, intervalAbsence);
  }

  private lastSeenDistance(total: number, positions: readonly number[]): number | null {
    if (positions.length === 0) return null;
    return total - 1 - positions[positions.length - 1];
  }

  private frequency(count: number, total: number): number {
    return this.clampScore(Math.round((count / Math.max(1, total)) * 100));
  }

  private windowFrequency(trios: readonly TriplicacaoTrio[], patternKind: TriplicacaoEnginePatternKind, windowSize: number): number {
    const window = trios.slice(Math.max(0, trios.length - windowSize));
    const count = window.filter((trio) => trio.patternKind === patternKind).length;
    return this.frequency(count, window.length);
  }

  private absenceScore(lastSeenDistance: number | null, averageInterval: number | null, total: number): number {
    if (lastSeenDistance === null) return 100;
    if (averageInterval === null || averageInterval <= 0) return this.clampScore(Math.round((lastSeenDistance / Math.max(1, total)) * 100));
    return this.clampScore(Math.round((lastSeenDistance / Math.max(1, averageInterval * 2)) * 100));
  }

  private recurrenceScore(intervals: readonly number[], occurrences: number, total: number): number {
    if (occurrences <= 1 || intervals.length === 0) return this.frequency(occurrences, total);
    const avg = this.average(intervals) ?? total;
    const variance = intervals.reduce((sum, interval) => sum + ((interval - avg) ** 2), 0) / intervals.length;
    const stability = this.clampScore(100 - Math.round(Math.sqrt(variance) * 20));
    const density = this.frequency(occurrences, total);
    return this.clampScore(Math.round((stability * 0.55) + (density * 0.45)));
  }

  private zScore(occurrences: number, total: number): number {
    if (total <= 0) return 0;
    const expected = total * EXPECTED_PATTERN_PROBABILITY;
    const variance = total * EXPECTED_PATTERN_PROBABILITY * (1 - EXPECTED_PATTERN_PROBABILITY);
    if (variance <= 0) return 0;
    return this.round3((occurrences - expected) / Math.sqrt(variance));
  }

  private conditionalScore(trios: readonly TriplicacaoTrio[], patternKind: TriplicacaoEnginePatternKind, continuation: boolean): number {
    let antecedents = 0;
    let matches = 0;

    for (let index = 0; index + 1 < trios.length; index += 1) {
      if (trios[index].patternKind !== patternKind) continue;
      antecedents += 1;
      const nextMatches = trios[index + 1].patternKind === patternKind;
      if (continuation ? nextMatches : !nextMatches) matches += 1;
    }

    return antecedents === 0 ? 0 : this.frequency(matches, antecedents);
  }

  private temporalDecayScore(shortScore: number, mediumScore: number, longScore: number): number {
    return this.clampScore(Math.round((shortScore * 0.5) + (mediumScore * 0.3) + (longScore * 0.2)));
  }

  private evidenceScore(input: {
    readonly observedFrequencyScore: number;
    readonly shortWindowFrequencyScore: number;
    readonly mediumWindowFrequencyScore: number;
    readonly longWindowFrequencyScore: number;
    readonly absenceScore: number;
    readonly recurrenceScore: number;
    readonly zScore: number;
    readonly conditionalContinuationScore: number;
    readonly temporalDecayScore: number;
  }): number {
    const zComponent = this.clampScore(Math.round(Math.max(0, input.zScore) * 18));
    const raw =
      (input.observedFrequencyScore * 0.16) +
      (input.shortWindowFrequencyScore * 0.15) +
      (input.mediumWindowFrequencyScore * 0.12) +
      (input.longWindowFrequencyScore * 0.08) +
      (input.recurrenceScore * 0.16) +
      (input.conditionalContinuationScore * 0.11) +
      (input.temporalDecayScore * 0.14) +
      (zComponent * 0.08) -
      (input.absenceScore * 0.08);

    return this.clampScore(Math.round(raw));
  }

  private pickMetric(metrics: readonly TriplicacaoRecurrenceMetrics[]): TriplicacaoRecurrenceMetrics | null {
    if (metrics.length === 0) return null;
    return metrics.reduce((best, current) => {
      if (current.evidenceScore > best.evidenceScore) return current;
      if (current.evidenceScore === best.evidenceScore && current.temporalDecayScore > best.temporalDecayScore) return current;
      return best;
    }, metrics[0]);
  }

  private calculateAdvancedConfidence(baseAnalysis: TriplicacaoPatternAnalysis, metric: TriplicacaoRecurrenceMetrics | null): number {
    if (metric === null) return 0;
    return this.clampRatio(
      (baseAnalysis.confidenceScore * 0.45) +
      ((metric.evidenceScore / 100) * 0.35) +
      ((metric.recurrenceScore / 100) * 0.12) +
      ((metric.conditionalContinuationScore / 100) * 0.08),
    );
  }

  private calculateAdvancedRisk(
    baseAnalysis: TriplicacaoPatternAnalysis,
    metric: TriplicacaoRecurrenceMetrics | null,
    advancedConfidenceScore: number,
  ): number {
    if (metric === null) return 1;
    return this.clampRatio(
      (baseAnalysis.riskScore * 0.45) +
      ((1 - advancedConfidenceScore) * 0.3) +
      ((metric.absenceScore / 100) * 0.15) +
      (((100 - metric.temporalDecayScore) / 100) * 0.1),
    );
  }

  private collectWarnings(inputs: readonly TriplicacaoConsensusInput[]): readonly string[] {
    const warnings = new Set<string>();
    for (const input of inputs) {
      for (const warning of input.warnings ?? []) warnings.add(`${input.strategyId}:${warning}`);
    }
    return Object.freeze([...warnings]);
  }

  private agreementLevel(score: number): 'NONE' | 'WEAK' | 'MODERATE' | 'STRONG' {
    if (score >= 75) return 'STRONG';
    if (score >= 55) return 'MODERATE';
    if (score > 0) return 'WEAK';
    return 'NONE';
  }

  private positiveIntegerOrDefault(value: number | undefined, fallback: number): number {
    return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : fallback;
  }

  private clampScore(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(100, Math.round(value)));
  }

  private clampRatio(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return this.round3(Math.max(0, Math.min(1, value)));
  }

  private round3(value: number): number {
    return Math.round(value * 1000) / 1000;
  }
}
