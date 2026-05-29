export type SessionPatternState =
  | 'INSUFFICIENT_DATA'
  | 'STABLE'
  | 'CAUTION'
  | 'DEGRADING'
  | 'FAILURE_PRONE'
  | 'COLLAPSED';

export type OperatorFingerprintState =
  | 'INSUFFICIENT_DATA'
  | 'DISCIPLINED'
  | 'BALANCED'
  | 'IMPULSIVE'
  | 'FATIGUE_PRONE'
  | 'OVERCONFIDENT'
  | 'TILT_PRONE'
  | 'RECOVERY_ORIENTED'
  | 'HIGH_RISK';

export type SessionRhythmState =
  | 'INSUFFICIENT_SAMPLE'
  | 'HEALTHY'
  | 'ACCELERATED'
  | 'EMOTIONAL'
  | 'IRRATIONAL'
  | 'COLLAPSING';

export type AntiChasingState =
  | 'CLEAR'
  | 'WATCH'
  | 'RISK'
  | 'CHASING'
  | 'LOCKED';

export type ContextualFailurePredictionState =
  | 'LOW'
  | 'WATCH'
  | 'ELEVATED'
  | 'HIGH'
  | 'CRITICAL';

export type ContextualFailureRecommendation =
  | 'OBSERVE_ONLY'
  | 'INCREASE_SUPERVISION'
  | 'VETO_OPERATION'
  | 'COOLDOWN_REQUIRED'
  | 'INTERRUPT_SESSION';

export type ContextualFailureGate = 'BLOCKED';

export interface ContextualFailurePredictionInput {
  readonly sessionId?: string;
  readonly operatorProfileId?: string;
  readonly sessionPatternState?: SessionPatternState;
  readonly operatorFingerprintState?: OperatorFingerprintState;
  readonly sessionRhythmState?: SessionRhythmState;
  readonly antiChasingState?: AntiChasingState;
  readonly degradationScore?: number;
  readonly failureRiskScore?: number;
  readonly impulsivityScore?: number;
  readonly tiltRiskScore?: number;
  readonly trustSeedScore?: number;
  readonly contextualRiskPressure?: number;
  readonly recoveryScore?: number;
  readonly recentLossStreak?: number;
  readonly recentSupervisorVetoes?: number;
  readonly recentCooldowns?: number;
}

interface NormalizedPredictionInput {
  readonly sessionId: string;
  readonly operatorProfileId: string;
  readonly sessionPatternState: SessionPatternState;
  readonly operatorFingerprintState: OperatorFingerprintState;
  readonly sessionRhythmState: SessionRhythmState;
  readonly antiChasingState: AntiChasingState;
  readonly degradationScore: number;
  readonly failureRiskScore: number;
  readonly impulsivityScore: number;
  readonly tiltRiskScore: number;
  readonly trustSeedScore: number;
  readonly contextualRiskPressure: number;
  readonly recoveryScore: number;
  readonly recentLossStreak: number;
  readonly recentSupervisorVetoes: number;
  readonly recentCooldowns: number;
}

export interface ContextualFailurePredictionReport {
  readonly sessionId: string;
  readonly operatorProfileId: string;
  readonly predictionState: ContextualFailurePredictionState;
  readonly recommendation: ContextualFailureRecommendation;
  readonly predictedFailureProbability: number;
  readonly earlyWarningScore: number;
  readonly compoundedRiskScore: number;
  readonly recoveryBufferScore: number;
  readonly requiresCooldown: boolean;
  readonly shouldInterrupt: boolean;
  readonly canSuggest: boolean;
  readonly gate: ContextualFailureGate;
  readonly operationalGate: ContextualFailureGate;
  readonly paperSessionGate: ContextualFailureGate;
  readonly liveSessionGate: ContextualFailureGate;
  readonly liveMoneyAuthorized: false;
  readonly reasons: readonly string[];
}

export class ContextualFailurePredictionEngine {
  public predict(input: ContextualFailurePredictionInput): ContextualFailurePredictionReport {
    const normalized = this.normalize(input);

    const recoveryBufferScore = this.clamp(
      normalized.recoveryScore * 0.55 + normalized.trustSeedScore * 0.45,
      0,
      100
    );

    const compoundedRiskScore = this.clamp(
      normalized.failureRiskScore * 0.22 +
        normalized.degradationScore * 0.18 +
        normalized.impulsivityScore * 0.16 +
        normalized.tiltRiskScore * 0.16 +
        normalized.contextualRiskPressure * 0.14 +
        this.patternPenalty(normalized.sessionPatternState) +
        this.fingerprintPenalty(normalized.operatorFingerprintState) +
        this.rhythmPenalty(normalized.sessionRhythmState) +
        this.antiChasingPenalty(normalized.antiChasingState) +
        normalized.recentLossStreak * 4 +
        normalized.recentSupervisorVetoes * 7 +
        normalized.recentCooldowns * 6 -
        recoveryBufferScore * 0.20,
      0,
      100
    );

    const predictedFailureProbability = this.clamp(
      compoundedRiskScore * 0.72 +
        Math.max(0, 100 - normalized.trustSeedScore) * 0.18 +
        Math.max(0, 100 - recoveryBufferScore) * 0.10,
      0,
      100
    );

    const earlyWarningScore = this.clamp(
      predictedFailureProbability * 0.65 +
        normalized.recentLossStreak * 5 +
        normalized.recentSupervisorVetoes * 8 +
        normalized.recentCooldowns * 6,
      0,
      100
    );

    const predictionState = this.classify(
      normalized,
      predictedFailureProbability,
      compoundedRiskScore,
      earlyWarningScore
    );

    const canSuggest = this.canSuggestSafely(normalized, predictionState);

    return Object.freeze({
      sessionId: normalized.sessionId,
      operatorProfileId: normalized.operatorProfileId,
      predictionState,
      recommendation: this.recommendationFor(predictionState),
      predictedFailureProbability: this.round(predictedFailureProbability),
      earlyWarningScore: this.round(earlyWarningScore),
      compoundedRiskScore: this.round(compoundedRiskScore),
      recoveryBufferScore: this.round(recoveryBufferScore),
      requiresCooldown: predictionState === 'HIGH' || predictionState === 'CRITICAL',
      shouldInterrupt: predictionState === 'CRITICAL',
      canSuggest,
      gate: 'BLOCKED',
      operationalGate: 'BLOCKED',
      paperSessionGate: 'BLOCKED',
      liveSessionGate: 'BLOCKED',
      liveMoneyAuthorized: false,
      reasons: this.reasonsFor(normalized, predictionState, predictedFailureProbability)
    });
  }

  public evaluate(input: ContextualFailurePredictionInput): ContextualFailurePredictionReport {
    return this.predict(input);
  }

  public execute(input: ContextualFailurePredictionInput): ContextualFailurePredictionReport {
    return this.predict(input);
  }

  private classify(
    input: NormalizedPredictionInput,
    predictedFailureProbability: number,
    compoundedRiskScore: number,
    earlyWarningScore: number
  ): ContextualFailurePredictionState {
    if (
      input.sessionPatternState === 'COLLAPSED' ||
      input.operatorFingerprintState === 'HIGH_RISK' ||
      input.sessionRhythmState === 'COLLAPSING' ||
      input.antiChasingState === 'CHASING' ||
      input.antiChasingState === 'LOCKED'
    ) {
      return 'CRITICAL';
    }

    if (
      input.sessionPatternState === 'FAILURE_PRONE' ||
      input.sessionRhythmState === 'IRRATIONAL' ||
      (
        (predictedFailureProbability >= 88 || compoundedRiskScore >= 88) &&
        (
          input.failureRiskScore >= 75 ||
          input.degradationScore >= 75 ||
          input.recentCooldowns > 0
        )
      )
    ) {
      return 'HIGH';
    }

    if (
      predictedFailureProbability >= 62 ||
      earlyWarningScore >= 62 ||
      input.sessionPatternState === 'DEGRADING' ||
      input.operatorFingerprintState === 'IMPULSIVE' ||
      input.operatorFingerprintState === 'TILT_PRONE'
    ) {
      return 'ELEVATED';
    }

    if (
      predictedFailureProbability >= 38 ||
      input.sessionPatternState === 'CAUTION' ||
      input.sessionRhythmState === 'ACCELERATED' ||
      input.sessionRhythmState === 'EMOTIONAL' ||
      input.antiChasingState === 'WATCH' ||
      input.antiChasingState === 'RISK'
    ) {
      return 'WATCH';
    }

    return 'LOW';
  }

  private canSuggestSafely(
    input: NormalizedPredictionInput,
    state: ContextualFailurePredictionState
  ): boolean {
    return (
      state === 'LOW' &&
      input.sessionPatternState === 'STABLE' &&
      (
        input.operatorFingerprintState === 'DISCIPLINED' ||
        input.operatorFingerprintState === 'BALANCED' ||
        input.operatorFingerprintState === 'RECOVERY_ORIENTED'
      ) &&
      input.sessionRhythmState === 'HEALTHY' &&
      input.antiChasingState === 'CLEAR'
    );
  }

  private recommendationFor(state: ContextualFailurePredictionState): ContextualFailureRecommendation {
    switch (state) {
      case 'LOW':
        return 'OBSERVE_ONLY';
      case 'WATCH':
        return 'INCREASE_SUPERVISION';
      case 'ELEVATED':
        return 'VETO_OPERATION';
      case 'HIGH':
        return 'COOLDOWN_REQUIRED';
      case 'CRITICAL':
        return 'INTERRUPT_SESSION';
    }
  }

  private reasonsFor(
    input: NormalizedPredictionInput,
    state: ContextualFailurePredictionState,
    probability: number
  ): readonly string[] {
    const reasons: string[] = [`PREDICTION_STATE:${state}`];

    if (probability >= 62) reasons.push('FAILURE_PROBABILITY_THRESHOLD_EXCEEDED');
    if (input.sessionPatternState === 'FAILURE_PRONE') reasons.push('SESSION_PATTERN_FAILURE_PRONE');
    if (input.sessionPatternState === 'COLLAPSED') reasons.push('SESSION_PATTERN_COLLAPSED');
    if (input.operatorFingerprintState === 'IMPULSIVE') reasons.push('OPERATOR_IMPULSIVITY_PATTERN');
    if (input.operatorFingerprintState === 'HIGH_RISK') reasons.push('OPERATOR_HIGH_RISK_FINGERPRINT');
    if (input.sessionRhythmState === 'IRRATIONAL') reasons.push('SESSION_RHYTHM_IRRATIONAL');
    if (input.sessionRhythmState === 'COLLAPSING') reasons.push('SESSION_RHYTHM_COLLAPSING');
    if (input.antiChasingState === 'CHASING' || input.antiChasingState === 'LOCKED') {
      reasons.push('ANTI_CHASING_TERMINAL_PATTERN');
    }
    if (input.recentLossStreak >= 3) reasons.push('RECENT_LOSS_STREAK_PRESSURE');
    if (input.recentSupervisorVetoes > 0) reasons.push('RECENT_SUPERVISOR_VETO_PRESSURE');
    if (input.recentCooldowns > 0) reasons.push('RECENT_COOLDOWN_PRESSURE');

    reasons.push('LIVE_MONEY_AUTHORIZATION:FALSE');
    reasons.push('OPERATIONAL_GATE:BLOCKED');

    return Object.freeze(reasons);
  }

  private normalize(input: ContextualFailurePredictionInput): NormalizedPredictionInput {
    return Object.freeze({
      sessionId: this.resolveId(input.sessionId, 'contextual-failure-session'),
      operatorProfileId: this.resolveId(input.operatorProfileId, 'anonymous-operator-profile'),
      sessionPatternState: this.normalizeSessionPattern(input.sessionPatternState),
      operatorFingerprintState: this.normalizeFingerprint(input.operatorFingerprintState),
      sessionRhythmState: this.normalizeRhythm(input.sessionRhythmState),
      antiChasingState: this.normalizeAntiChasing(input.antiChasingState),
      degradationScore: this.score(input.degradationScore, 0),
      failureRiskScore: this.score(input.failureRiskScore, 0),
      impulsivityScore: this.score(input.impulsivityScore, 0),
      tiltRiskScore: this.score(input.tiltRiskScore, 0),
      trustSeedScore: this.score(input.trustSeedScore, 100),
      contextualRiskPressure: this.score(input.contextualRiskPressure, 0),
      recoveryScore: this.score(input.recoveryScore, 0),
      recentLossStreak: this.nonNegativeInteger(input.recentLossStreak),
      recentSupervisorVetoes: this.nonNegativeInteger(input.recentSupervisorVetoes),
      recentCooldowns: this.nonNegativeInteger(input.recentCooldowns)
    });
  }

  private patternPenalty(state: SessionPatternState): number {
    switch (state) {
      case 'INSUFFICIENT_DATA': return 6;
      case 'STABLE': return 0;
      case 'CAUTION': return 8;
      case 'DEGRADING': return 18;
      case 'FAILURE_PRONE': return 32;
      case 'COLLAPSED': return 50;
    }
  }

  private fingerprintPenalty(state: OperatorFingerprintState): number {
    switch (state) {
      case 'INSUFFICIENT_DATA': return 6;
      case 'DISCIPLINED': return -6;
      case 'BALANCED': return 0;
      case 'RECOVERY_ORIENTED': return -4;
      case 'FATIGUE_PRONE': return 10;
      case 'OVERCONFIDENT': return 14;
      case 'IMPULSIVE': return 20;
      case 'TILT_PRONE': return 24;
      case 'HIGH_RISK': return 50;
    }
  }

  private rhythmPenalty(state: SessionRhythmState): number {
    switch (state) {
      case 'INSUFFICIENT_SAMPLE': return 6;
      case 'HEALTHY': return 0;
      case 'ACCELERATED': return 8;
      case 'EMOTIONAL': return 12;
      case 'IRRATIONAL': return 26;
      case 'COLLAPSING': return 50;
    }
  }

  private antiChasingPenalty(state: AntiChasingState): number {
    switch (state) {
      case 'CLEAR': return 0;
      case 'WATCH': return 8;
      case 'RISK': return 18;
      case 'CHASING': return 45;
      case 'LOCKED': return 50;
    }
  }

  private normalizeSessionPattern(value: SessionPatternState | undefined): SessionPatternState {
    switch (value) {
      case 'INSUFFICIENT_DATA':
      case 'STABLE':
      case 'CAUTION':
      case 'DEGRADING':
      case 'FAILURE_PRONE':
      case 'COLLAPSED':
        return value;
      default:
        return 'INSUFFICIENT_DATA';
    }
  }

  private normalizeFingerprint(value: OperatorFingerprintState | undefined): OperatorFingerprintState {
    switch (value) {
      case 'INSUFFICIENT_DATA':
      case 'DISCIPLINED':
      case 'BALANCED':
      case 'IMPULSIVE':
      case 'FATIGUE_PRONE':
      case 'OVERCONFIDENT':
      case 'TILT_PRONE':
      case 'RECOVERY_ORIENTED':
      case 'HIGH_RISK':
        return value;
      default:
        return 'INSUFFICIENT_DATA';
    }
  }

  private normalizeRhythm(value: SessionRhythmState | undefined): SessionRhythmState {
    switch (value) {
      case 'INSUFFICIENT_SAMPLE':
      case 'HEALTHY':
      case 'ACCELERATED':
      case 'EMOTIONAL':
      case 'IRRATIONAL':
      case 'COLLAPSING':
        return value;
      default:
        return 'INSUFFICIENT_SAMPLE';
    }
  }

  private normalizeAntiChasing(value: AntiChasingState | undefined): AntiChasingState {
    switch (value) {
      case 'CLEAR':
      case 'WATCH':
      case 'RISK':
      case 'CHASING':
      case 'LOCKED':
        return value;
      default:
        return 'CLEAR';
    }
  }

  private resolveId(value: string | undefined, fallback: string): string {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
  }

  private score(value: number | undefined, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value)
      ? this.round(this.clamp(value, 0, 100))
      : fallback;
  }

  private nonNegativeInteger(value: number | undefined): number {
    return typeof value === 'number' && Number.isFinite(value) && value > 0
      ? Math.floor(value)
      : 0;
  }

  private clamp(value: number, minimum: number, maximum: number): number {
    return Math.min(maximum, Math.max(minimum, value));
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
