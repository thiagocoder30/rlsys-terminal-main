export type InstitutionalStrategyId =
  | 'fusion-reduzida'
  | 'triplicacao'
  | 'custom';

export type InstitutionalStrategySource =
  | 'FUSION_REDUZIDA'
  | 'TRIPLICACAO'
  | 'CUSTOM';

export type InstitutionalConsensusMode =
  | 'BLOCKED'
  | 'OBSERVE'
  | 'PAPER_ONLY';

export type InstitutionalAgreementLevel =
  | 'NONE'
  | 'WEAK'
  | 'MODERATE'
  | 'STRONG';

export interface InstitutionalStrategySignal {
  readonly strategyId: InstitutionalStrategyId | string;
  readonly source: InstitutionalStrategySource;
  readonly enabled: boolean;
  readonly confidenceScore: number;
  readonly riskScore: number;
  readonly evidenceScore?: number;
  readonly recencyScore?: number;
  readonly volatilityScore?: number;
  readonly absenceScore?: number;
  readonly blockers?: readonly string[];
  readonly warnings?: readonly string[];
  readonly reasons?: readonly string[];
  readonly suggestedMode?: InstitutionalConsensusMode;
}

export interface InstitutionalConsensusRuntimeOptions {
  readonly minAcceptedStrategies?: number;
  readonly paperConsensusThreshold?: number;
  readonly maxPaperRiskScore?: number;
  readonly minAverageConfidence?: number;
  readonly requireFusionAndTriplicacaoAgreement?: boolean;
}

export interface InstitutionalStrategySignalAssessment {
  readonly strategyId: string;
  readonly source: InstitutionalStrategySource;
  readonly accepted: boolean;
  readonly normalizedConfidenceScore: number;
  readonly normalizedRiskScore: number;
  readonly normalizedEvidenceScore: number;
  readonly normalizedRecencyScore: number;
  readonly contributionScore: number;
  readonly blockers: readonly string[];
  readonly warnings: readonly string[];
  readonly reasons: readonly string[];
}

export interface InstitutionalConsensusDecision {
  readonly inputCount: number;
  readonly acceptedInputCount: number;
  readonly requiredAcceptedInputCount: number;
  readonly consensusScore: number;
  readonly consensusRiskScore: number;
  readonly averageConfidenceScore: number;
  readonly averageEvidenceScore: number;
  readonly agreementLevel: InstitutionalAgreementLevel;
  readonly operationalMode: InstitutionalConsensusMode;
  readonly liveMoneyAuthorized: false;
  readonly operatorDecisionRequired: true;
  readonly supervisedRecommendationOnly: true;
  readonly productionMoneyAllowed: false;
  readonly assessments: readonly InstitutionalStrategySignalAssessment[];
  readonly acceptedStrategyIds: readonly string[];
  readonly reasons: readonly string[];
  readonly warnings: readonly string[];
  readonly blockers: readonly string[];
  readonly hudSummary: string;
}

const DEFAULT_MIN_ACCEPTED_STRATEGIES = 2;
const DEFAULT_PAPER_CONSENSUS_THRESHOLD = 70;
const DEFAULT_MAX_PAPER_RISK_SCORE = 0.35;
const DEFAULT_MIN_AVERAGE_CONFIDENCE = 0.7;

export class InstitutionalMultiStrategyConsensusRuntime {
  public evaluate(
    signals: readonly InstitutionalStrategySignal[],
    options: InstitutionalConsensusRuntimeOptions = {},
  ): InstitutionalConsensusDecision {
    const requiredAcceptedInputCount = this.positiveIntegerOrDefault(
      options.minAcceptedStrategies,
      DEFAULT_MIN_ACCEPTED_STRATEGIES,
    );
    const paperConsensusThreshold = this.clampScore(
      this.positiveIntegerOrDefault(
        options.paperConsensusThreshold,
        DEFAULT_PAPER_CONSENSUS_THRESHOLD,
      ),
    );
    const maxPaperRiskScore = this.clampRatio(
      typeof options.maxPaperRiskScore === 'number'
        ? options.maxPaperRiskScore
        : DEFAULT_MAX_PAPER_RISK_SCORE,
    );
    const minAverageConfidence = this.clampRatio(
      typeof options.minAverageConfidence === 'number'
        ? options.minAverageConfidence
        : DEFAULT_MIN_AVERAGE_CONFIDENCE,
    );
    const requireFusionAndTriplicacaoAgreement = options.requireFusionAndTriplicacaoAgreement ?? true;

    const assessments = Object.freeze(signals.map((signal) => this.assess(signal)));
    const acceptedAssessments = assessments.filter((assessment) => assessment.accepted);

    const acceptedInputCount = acceptedAssessments.length;
    const acceptedStrategyIds = Object.freeze(acceptedAssessments.map((assessment) => assessment.strategyId));

    const averageConfidenceScore = this.averageRatio(
      acceptedAssessments.map((assessment) => assessment.normalizedConfidenceScore),
    );
    const averageEvidenceScore = this.averageScore(
      acceptedAssessments.map((assessment) => assessment.normalizedEvidenceScore),
    );
    const consensusRiskScore = this.averageRatio(
      acceptedAssessments.map((assessment) => assessment.normalizedRiskScore),
      1,
    );
    const consensusScore = this.calculateConsensusScore(
      acceptedAssessments,
      signals.length,
    );
    const agreementLevel = this.agreementLevel(consensusScore);

    const hasFusion = acceptedAssessments.some((assessment) => assessment.source === 'FUSION_REDUZIDA');
    const hasTriplicacao = acceptedAssessments.some((assessment) => assessment.source === 'TRIPLICACAO');
    const hasRequiredPair = !requireFusionAndTriplicacaoAgreement || (hasFusion && hasTriplicacao);

    const blockers = this.collectBlockers({
      assessments,
      acceptedInputCount,
      requiredAcceptedInputCount,
      consensusScore,
      paperConsensusThreshold,
      consensusRiskScore,
      maxPaperRiskScore,
      averageConfidenceScore,
      minAverageConfidence,
      hasRequiredPair,
    });

    const operationalMode: InstitutionalConsensusMode =
      blockers.length === 0
        ? 'PAPER_ONLY'
        : acceptedInputCount === 0
          ? 'BLOCKED'
          : 'OBSERVE';

    const reasons = Object.freeze([
      `CONSENSUS_INPUTS:${signals.length}`,
      `CONSENSUS_ACCEPTED:${acceptedInputCount}`,
      `CONSENSUS_SCORE:${consensusScore}`,
      `CONSENSUS_RISK:${consensusRiskScore}`,
      `CONSENSUS_AVG_CONFIDENCE:${averageConfidenceScore}`,
      `CONSENSUS_AVG_EVIDENCE:${averageEvidenceScore}`,
      `CONSENSUS_AGREEMENT:${agreementLevel}`,
      ...(hasFusion ? ['FUSION_REDUZIDA_ACCEPTED'] : ['FUSION_REDUZIDA_NOT_ACCEPTED']),
      ...(hasTriplicacao ? ['TRIPLICACAO_ACCEPTED'] : ['TRIPLICACAO_NOT_ACCEPTED']),
    ]);

    const warnings = Object.freeze(this.collectWarnings(assessments, operationalMode));

    return Object.freeze({
      inputCount: signals.length,
      acceptedInputCount,
      requiredAcceptedInputCount,
      consensusScore,
      consensusRiskScore,
      averageConfidenceScore,
      averageEvidenceScore,
      agreementLevel,
      operationalMode,
      liveMoneyAuthorized: false,
      operatorDecisionRequired: true,
      supervisedRecommendationOnly: true,
      productionMoneyAllowed: false,
      assessments,
      acceptedStrategyIds,
      reasons,
      warnings,
      blockers: Object.freeze(blockers),
      hudSummary: this.composeHudSummary({
        operationalMode,
        consensusScore,
        consensusRiskScore,
        averageConfidenceScore,
        acceptedInputCount,
        requiredAcceptedInputCount,
        agreementLevel,
      }),
    });
  }

  public fromTriplicacaoAdvancedAnalysis(input: {
    readonly confidenceScore: number;
    readonly riskScore: number;
    readonly evidenceScore: number;
    readonly probabilityMode: InstitutionalConsensusMode | 'INSUFFICIENT_DATA';
    readonly blockers?: readonly string[];
    readonly warnings?: readonly string[];
    readonly reasons?: readonly string[];
  }): InstitutionalStrategySignal {
    return Object.freeze({
      strategyId: 'triplicacao',
      source: 'TRIPLICACAO',
      enabled: true,
      confidenceScore: input.confidenceScore,
      riskScore: input.riskScore,
      evidenceScore: input.evidenceScore,
      blockers: input.probabilityMode === 'PAPER_ONLY'
        ? Object.freeze([...(input.blockers ?? [])])
        : Object.freeze(['TRIPLICACAO_NOT_PAPER_READY', ...(input.blockers ?? [])]),
      warnings: Object.freeze([...(input.warnings ?? [])]),
      reasons: Object.freeze([...(input.reasons ?? [])]),
      suggestedMode: input.probabilityMode === 'PAPER_ONLY' ? 'PAPER_ONLY' : 'OBSERVE',
    });
  }

  public fromFusionReducedAnalysis(input: {
    readonly confidenceScore: number;
    readonly riskScore: number;
    readonly evidenceScore?: number;
    readonly operationalMode?: InstitutionalConsensusMode;
    readonly blockers?: readonly string[];
    readonly warnings?: readonly string[];
    readonly reasons?: readonly string[];
  }): InstitutionalStrategySignal {
    return Object.freeze({
      strategyId: 'fusion-reduzida',
      source: 'FUSION_REDUZIDA',
      enabled: true,
      confidenceScore: input.confidenceScore,
      riskScore: input.riskScore,
      evidenceScore: input.evidenceScore ?? Math.round(this.clampRatio(input.confidenceScore) * 100),
      blockers: input.operationalMode === 'PAPER_ONLY'
        ? Object.freeze([...(input.blockers ?? [])])
        : Object.freeze(['FUSION_REDUZIDA_NOT_PAPER_READY', ...(input.blockers ?? [])]),
      warnings: Object.freeze([...(input.warnings ?? [])]),
      reasons: Object.freeze([...(input.reasons ?? [])]),
      suggestedMode: input.operationalMode ?? 'OBSERVE',
    });
  }

  private assess(signal: InstitutionalStrategySignal): InstitutionalStrategySignalAssessment {
    const blockers = Object.freeze([...(signal.blockers ?? [])]);
    const warnings = Object.freeze([...(signal.warnings ?? [])]);
    const reasons = Object.freeze([...(signal.reasons ?? [])]);
    const normalizedConfidenceScore = this.clampRatio(signal.confidenceScore);
    const normalizedRiskScore = this.clampRatio(signal.riskScore);
    const normalizedEvidenceScore = this.clampScore(
      typeof signal.evidenceScore === 'number'
        ? signal.evidenceScore
        : Math.round(normalizedConfidenceScore * 100),
    );
    const normalizedRecencyScore = this.clampScore(
      typeof signal.recencyScore === 'number'
        ? signal.recencyScore
        : normalizedEvidenceScore,
    );
    const volatilityPenalty = this.clampScore(
      typeof signal.volatilityScore === 'number'
        ? signal.volatilityScore
        : 0,
    );
    const absencePenalty = this.clampScore(
      typeof signal.absenceScore === 'number'
        ? signal.absenceScore
        : 0,
    );

    const contributionScore = this.clampScore(Math.round(
      (normalizedConfidenceScore * 100 * 0.38) +
      (normalizedEvidenceScore * 0.27) +
      (normalizedRecencyScore * 0.18) +
      ((100 - (normalizedRiskScore * 100)) * 0.17) -
      (volatilityPenalty * 0.05) -
      (absencePenalty * 0.04),
    ));

    const accepted =
      signal.enabled &&
      blockers.length === 0 &&
      normalizedConfidenceScore >= 0.55 &&
      normalizedRiskScore <= 0.6 &&
      contributionScore > 0;

    return Object.freeze({
      strategyId: signal.strategyId,
      source: signal.source,
      accepted,
      normalizedConfidenceScore,
      normalizedRiskScore,
      normalizedEvidenceScore,
      normalizedRecencyScore,
      contributionScore,
      blockers,
      warnings,
      reasons,
    });
  }

  private calculateConsensusScore(
    acceptedAssessments: readonly InstitutionalStrategySignalAssessment[],
    totalInputCount: number,
  ): number {
    if (acceptedAssessments.length === 0 || totalInputCount === 0) {
      return 0;
    }

    const contributionAverage = this.averageScore(
      acceptedAssessments.map((assessment) => assessment.contributionScore),
    );
    const participationScore = acceptedAssessments.length / totalInputCount;

    return this.clampScore(Math.round(contributionAverage * participationScore));
  }

  private collectBlockers(input: {
    readonly assessments: readonly InstitutionalStrategySignalAssessment[];
    readonly acceptedInputCount: number;
    readonly requiredAcceptedInputCount: number;
    readonly consensusScore: number;
    readonly paperConsensusThreshold: number;
    readonly consensusRiskScore: number;
    readonly maxPaperRiskScore: number;
    readonly averageConfidenceScore: number;
    readonly minAverageConfidence: number;
    readonly hasRequiredPair: boolean;
  }): string[] {
    const blockers: string[] = [];

    if (input.assessments.length === 0) {
      blockers.push('CONSENSUS_NO_STRATEGY_INPUTS');
    }

    if (input.acceptedInputCount < input.requiredAcceptedInputCount) {
      blockers.push('CONSENSUS_ACCEPTED_STRATEGIES_INSUFFICIENT');
    }

    if (input.consensusScore < input.paperConsensusThreshold) {
      blockers.push('CONSENSUS_SCORE_BELOW_THRESHOLD');
    }

    if (input.consensusRiskScore > input.maxPaperRiskScore) {
      blockers.push('CONSENSUS_RISK_ABOVE_THRESHOLD');
    }

    if (input.averageConfidenceScore < input.minAverageConfidence) {
      blockers.push('CONSENSUS_CONFIDENCE_BELOW_THRESHOLD');
    }

    if (!input.hasRequiredPair) {
      blockers.push('CONSENSUS_REQUIRES_FUSION_AND_TRIPLICACAO');
    }

    for (const assessment of input.assessments) {
      for (const blocker of assessment.blockers) {
        blockers.push(`${assessment.strategyId}:${blocker}`);
      }
    }

    return blockers;
  }

  private collectWarnings(
    assessments: readonly InstitutionalStrategySignalAssessment[],
    operationalMode: InstitutionalConsensusMode,
  ): string[] {
    const warnings: string[] = [];

    for (const assessment of assessments) {
      for (const warning of assessment.warnings) {
        warnings.push(`${assessment.strategyId}:${warning}`);
      }
    }

    if (operationalMode === 'PAPER_ONLY') {
      warnings.push('PAPER_ONLY_REQUIRES_OPERATOR_CONFIRMATION');
      warnings.push('LIVE_MONEY_REMAINS_BLOCKED');
    }

    return warnings;
  }

  private composeHudSummary(input: {
    readonly operationalMode: InstitutionalConsensusMode;
    readonly consensusScore: number;
    readonly consensusRiskScore: number;
    readonly averageConfidenceScore: number;
    readonly acceptedInputCount: number;
    readonly requiredAcceptedInputCount: number;
    readonly agreementLevel: InstitutionalAgreementLevel;
  }): string {
    return [
      `mode=${input.operationalMode}`,
      `agreement=${input.agreementLevel}`,
      `score=${input.consensusScore}`,
      `risk=${input.consensusRiskScore}`,
      `confidence=${input.averageConfidenceScore}`,
      `accepted=${input.acceptedInputCount}/${input.requiredAcceptedInputCount}`,
      'liveMoneyAuthorized=false',
    ].join(' | ');
  }

  private agreementLevel(score: number): InstitutionalAgreementLevel {
    if (score >= 75) {
      return 'STRONG';
    }

    if (score >= 60) {
      return 'MODERATE';
    }

    if (score > 0) {
      return 'WEAK';
    }

    return 'NONE';
  }

  private averageScore(values: readonly number[], fallback = 0): number {
    if (values.length === 0) {
      return fallback;
    }

    const sum = values.reduce((current, value) => current + this.clampScore(value), 0);
    return this.clampScore(Math.round(sum / values.length));
  }

  private averageRatio(values: readonly number[], fallback = 0): number {
    if (values.length === 0) {
      return fallback;
    }

    const sum = values.reduce((current, value) => current + this.clampRatio(value), 0);
    return this.clampRatio(sum / values.length);
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
