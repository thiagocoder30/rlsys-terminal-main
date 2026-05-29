export type InstitutionalTrustState =
  | 'UNVERIFIED'
  | 'TRUSTED'
  | 'STABLE'
  | 'WATCHLIST'
  | 'RESTRICTED'
  | 'LOCKED';

export type ContextualFailurePredictionState =
  | 'LOW'
  | 'WATCH'
  | 'ELEVATED'
  | 'HIGH'
  | 'CRITICAL';

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

export type AdaptiveSupervisionMode =
  | 'STANDARD'
  | 'STRICT'
  | 'PROTECTIVE'
  | 'LOCKDOWN'
  | 'RECOVERY';

export type AdaptiveSupervisionGate = 'BLOCKED';

export interface AdaptiveSupervisionInput {
  readonly sessionId?: string;
  readonly operatorProfileId?: string;
  readonly trustState?: InstitutionalTrustState;
  readonly predictionState?: ContextualFailurePredictionState;
  readonly sessionPatternState?: SessionPatternState;
  readonly operatorFingerprintState?: OperatorFingerprintState;
  readonly trustScore?: number;
  readonly predictedFailureProbability?: number;
  readonly degradationScore?: number;
  readonly impulsivityScore?: number;
  readonly tiltRiskScore?: number;
  readonly recoveryScore?: number;
  readonly recentCooldowns?: number;
  readonly recentVetoes?: number;
  readonly recentInterruptions?: number;
}

interface NormalizedAdaptiveSupervisionInput {
  readonly sessionId: string;
  readonly operatorProfileId: string;
  readonly trustState: InstitutionalTrustState;
  readonly predictionState: ContextualFailurePredictionState;
  readonly sessionPatternState: SessionPatternState;
  readonly operatorFingerprintState: OperatorFingerprintState;
  readonly trustScore: number;
  readonly predictedFailureProbability: number;
  readonly degradationScore: number;
  readonly impulsivityScore: number;
  readonly tiltRiskScore: number;
  readonly recoveryScore: number;
  readonly recentCooldowns: number;
  readonly recentVetoes: number;
  readonly recentInterruptions: number;
}

export interface AdaptiveSupervisionReport {
  readonly sessionId: string;
  readonly operatorProfileId: string;
  readonly supervisionMode: AdaptiveSupervisionMode;
  readonly supervisionStrictnessScore: number;
  readonly cooldownMultiplier: number;
  readonly vetoThresholdAdjustment: number;
  readonly suggestionThresholdAdjustment: number;
  readonly interruptionSensitivity: number;
  readonly requiresCooldown: boolean;
  readonly shouldRestrict: boolean;
  readonly shouldInterrupt: boolean;
  readonly canSuggest: boolean;
  readonly gate: AdaptiveSupervisionGate;
  readonly operationalGate: AdaptiveSupervisionGate;
  readonly paperSessionGate: AdaptiveSupervisionGate;
  readonly liveSessionGate: AdaptiveSupervisionGate;
  readonly liveMoneyAuthorized: false;
  readonly reasons: readonly string[];
}

export class AdaptiveSupervisionIntelligenceEngine {
  public evaluate(input: AdaptiveSupervisionInput): AdaptiveSupervisionReport {
    const normalized = this.normalize(input);
    const supervisionStrictnessScore = this.calculateStrictness(normalized);
    const supervisionMode = this.classify(normalized, supervisionStrictnessScore);

    return Object.freeze({
      sessionId: normalized.sessionId,
      operatorProfileId: normalized.operatorProfileId,
      supervisionMode,
      supervisionStrictnessScore: this.round(supervisionStrictnessScore),
      cooldownMultiplier: this.cooldownMultiplierFor(supervisionMode, supervisionStrictnessScore),
      vetoThresholdAdjustment: this.vetoAdjustmentFor(supervisionMode),
      suggestionThresholdAdjustment: this.suggestionAdjustmentFor(supervisionMode),
      interruptionSensitivity: this.interruptionSensitivityFor(supervisionMode, normalized),
      requiresCooldown: supervisionMode === 'PROTECTIVE' || supervisionMode === 'LOCKDOWN',
      shouldRestrict: supervisionMode === 'STRICT' || supervisionMode === 'PROTECTIVE' || supervisionMode === 'LOCKDOWN',
      shouldInterrupt: supervisionMode === 'LOCKDOWN',
      canSuggest: this.canSuggestSafely(normalized, supervisionMode),
      gate: 'BLOCKED',
      operationalGate: 'BLOCKED',
      paperSessionGate: 'BLOCKED',
      liveSessionGate: 'BLOCKED',
      liveMoneyAuthorized: false,
      reasons: this.reasonsFor(normalized, supervisionMode, supervisionStrictnessScore)
    });
  }

  public analyze(input: AdaptiveSupervisionInput): AdaptiveSupervisionReport {
    return this.evaluate(input);
  }

  public execute(input: AdaptiveSupervisionInput): AdaptiveSupervisionReport {
    return this.evaluate(input);
  }

  private calculateStrictness(input: NormalizedAdaptiveSupervisionInput): number {
    return this.clamp(
      (100 - input.trustScore) * 0.26 +
        input.predictedFailureProbability * 0.24 +
        input.degradationScore * 0.14 +
        input.impulsivityScore * 0.12 +
        input.tiltRiskScore * 0.12 +
        this.trustPenalty(input.trustState) +
        this.predictionPenalty(input.predictionState) +
        this.patternPenalty(input.sessionPatternState) +
        this.fingerprintPenalty(input.operatorFingerprintState) +
        input.recentCooldowns * 5 +
        input.recentVetoes * 6 +
        input.recentInterruptions * 18 -
        input.recoveryScore * 0.14,
      0,
      100
    );
  }

  private classify(
    input: NormalizedAdaptiveSupervisionInput,
    strictnessScore: number
  ): AdaptiveSupervisionMode {
    if (
      input.trustState === 'LOCKED' ||
      input.predictionState === 'CRITICAL' ||
      input.sessionPatternState === 'COLLAPSED' ||
      input.operatorFingerprintState === 'HIGH_RISK' ||
      input.recentInterruptions > 0
    ) {
      return 'LOCKDOWN';
    }

    if (
      input.trustState === 'RESTRICTED' ||
      input.predictionState === 'HIGH' ||
      input.sessionPatternState === 'FAILURE_PRONE'
    ) {
      return 'PROTECTIVE';
    }

    if (
      input.trustState === 'WATCHLIST' ||
      input.predictionState === 'ELEVATED' ||
      input.sessionPatternState === 'DEGRADING' ||
      input.operatorFingerprintState === 'IMPULSIVE' ||
      input.operatorFingerprintState === 'TILT_PRONE' ||
      strictnessScore >= 55
    ) {
      return 'STRICT';
    }

    if (
      input.trustState === 'STABLE' &&
      input.predictionState === 'LOW' &&
      input.sessionPatternState === 'STABLE' &&
      input.operatorFingerprintState === 'RECOVERY_ORIENTED' &&
      input.recoveryScore >= 60 &&
      input.predictedFailureProbability < 38
    ) {
      return 'RECOVERY';
    }

    return 'STANDARD';
  }

  private canSuggestSafely(
    input: NormalizedAdaptiveSupervisionInput,
    mode: AdaptiveSupervisionMode
  ): boolean {
    if (mode !== 'STANDARD' && mode !== 'RECOVERY') {
      return false;
    }

    return (
      input.predictionState === 'LOW' &&
      input.sessionPatternState === 'STABLE' &&
      (
        input.operatorFingerprintState === 'DISCIPLINED' ||
        input.operatorFingerprintState === 'BALANCED' ||
        input.operatorFingerprintState === 'RECOVERY_ORIENTED'
      ) &&
      (
        input.trustState === 'TRUSTED' ||
        input.trustState === 'STABLE'
      ) &&
      input.trustScore >= 70
    );
  }

  private cooldownMultiplierFor(mode: AdaptiveSupervisionMode, strictnessScore: number): number {
    switch (mode) {
      case 'STANDARD':
        return 1;
      case 'RECOVERY':
        return 1.25;
      case 'STRICT':
        return this.round(1.5 + strictnessScore / 200);
      case 'PROTECTIVE':
        return this.round(2.25 + strictnessScore / 160);
      case 'LOCKDOWN':
        return 4;
    }
  }

  private vetoAdjustmentFor(mode: AdaptiveSupervisionMode): number {
    switch (mode) {
      case 'STANDARD':
        return 0;
      case 'RECOVERY':
        return -4;
      case 'STRICT':
        return -10;
      case 'PROTECTIVE':
        return -18;
      case 'LOCKDOWN':
        return -35;
    }
  }

  private suggestionAdjustmentFor(mode: AdaptiveSupervisionMode): number {
    switch (mode) {
      case 'STANDARD':
        return 0;
      case 'RECOVERY':
        return 8;
      case 'STRICT':
        return 14;
      case 'PROTECTIVE':
        return 28;
      case 'LOCKDOWN':
        return 100;
    }
  }

  private interruptionSensitivityFor(
    mode: AdaptiveSupervisionMode,
    input: NormalizedAdaptiveSupervisionInput
  ): number {
    const base = (() => {
      switch (mode) {
        case 'STANDARD':
          return 20;
        case 'RECOVERY':
          return 28;
        case 'STRICT':
          return 48;
        case 'PROTECTIVE':
          return 72;
        case 'LOCKDOWN':
          return 100;
      }
    })();

    return this.round(this.clamp(base + input.recentInterruptions * 10 + input.recentVetoes * 3, 0, 100));
  }

  private reasonsFor(
    input: NormalizedAdaptiveSupervisionInput,
    mode: AdaptiveSupervisionMode,
    strictnessScore: number
  ): readonly string[] {
    const reasons: string[] = [`ADAPTIVE_SUPERVISION_MODE:${mode}`];

    if (input.trustState === 'LOCKED' || input.trustState === 'RESTRICTED') reasons.push('TRUST_STATE_RESTRICTIVE');
    if (input.predictionState === 'HIGH' || input.predictionState === 'CRITICAL') reasons.push('FAILURE_PREDICTION_RESTRICTIVE');
    if (input.sessionPatternState === 'FAILURE_PRONE' || input.sessionPatternState === 'COLLAPSED') reasons.push('SESSION_PATTERN_RESTRICTIVE');
    if (input.operatorFingerprintState === 'IMPULSIVE' || input.operatorFingerprintState === 'TILT_PRONE' || input.operatorFingerprintState === 'HIGH_RISK') reasons.push('OPERATOR_FINGERPRINT_RESTRICTIVE');
    if (input.recoveryScore >= 60) reasons.push('RECOVERY_BUFFER_PRESENT');
    if (strictnessScore >= 55) reasons.push('STRICTNESS_THRESHOLD_EXCEEDED');

    reasons.push('LIVE_MONEY_AUTHORIZATION:FALSE');
    reasons.push('OPERATIONAL_GATE:BLOCKED');

    return Object.freeze(reasons);
  }

  private normalize(input: AdaptiveSupervisionInput): NormalizedAdaptiveSupervisionInput {
    return Object.freeze({
      sessionId: this.resolveId(input.sessionId, 'adaptive-supervision-session'),
      operatorProfileId: this.resolveId(input.operatorProfileId, 'anonymous-operator-profile'),
      trustState: this.normalizeTrust(input.trustState),
      predictionState: this.normalizePrediction(input.predictionState),
      sessionPatternState: this.normalizePattern(input.sessionPatternState),
      operatorFingerprintState: this.normalizeFingerprint(input.operatorFingerprintState),
      trustScore: this.score(input.trustScore, 50),
      predictedFailureProbability: this.score(input.predictedFailureProbability, 50),
      degradationScore: this.score(input.degradationScore, 0),
      impulsivityScore: this.score(input.impulsivityScore, 0),
      tiltRiskScore: this.score(input.tiltRiskScore, 0),
      recoveryScore: this.score(input.recoveryScore, 0),
      recentCooldowns: this.nonNegativeInteger(input.recentCooldowns),
      recentVetoes: this.nonNegativeInteger(input.recentVetoes),
      recentInterruptions: this.nonNegativeInteger(input.recentInterruptions)
    });
  }

  private normalizeTrust(value: InstitutionalTrustState | undefined): InstitutionalTrustState {
    switch (value) {
      case 'UNVERIFIED':
      case 'TRUSTED':
      case 'STABLE':
      case 'WATCHLIST':
      case 'RESTRICTED':
      case 'LOCKED':
        return value;
      default:
        return 'UNVERIFIED';
    }
  }

  private normalizePrediction(value: ContextualFailurePredictionState | undefined): ContextualFailurePredictionState {
    switch (value) {
      case 'LOW':
      case 'WATCH':
      case 'ELEVATED':
      case 'HIGH':
      case 'CRITICAL':
        return value;
      default:
        return 'WATCH';
    }
  }

  private normalizePattern(value: SessionPatternState | undefined): SessionPatternState {
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

  private trustPenalty(state: InstitutionalTrustState): number {
    switch (state) {
      case 'TRUSTED': return -10;
      case 'STABLE': return -4;
      case 'UNVERIFIED': return 8;
      case 'WATCHLIST': return 18;
      case 'RESTRICTED': return 34;
      case 'LOCKED': return 55;
    }
  }

  private predictionPenalty(state: ContextualFailurePredictionState): number {
    switch (state) {
      case 'LOW': return -8;
      case 'WATCH': return 8;
      case 'ELEVATED': return 20;
      case 'HIGH': return 36;
      case 'CRITICAL': return 60;
    }
  }

  private patternPenalty(state: SessionPatternState): number {
    switch (state) {
      case 'INSUFFICIENT_DATA': return 6;
      case 'STABLE': return -4;
      case 'CAUTION': return 8;
      case 'DEGRADING': return 18;
      case 'FAILURE_PRONE': return 34;
      case 'COLLAPSED': return 60;
    }
  }

  private fingerprintPenalty(state: OperatorFingerprintState): number {
    switch (state) {
      case 'DISCIPLINED': return -8;
      case 'RECOVERY_ORIENTED': return -4;
      case 'BALANCED': return 0;
      case 'INSUFFICIENT_DATA': return 6;
      case 'FATIGUE_PRONE': return 12;
      case 'OVERCONFIDENT': return 16;
      case 'IMPULSIVE': return 24;
      case 'TILT_PRONE': return 30;
      case 'HIGH_RISK': return 60;
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
