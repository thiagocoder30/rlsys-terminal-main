export type InstitutionalTrustState =
  | 'UNVERIFIED'
  | 'TRUSTED'
  | 'STABLE'
  | 'WATCHLIST'
  | 'RESTRICTED'
  | 'LOCKED';

export type InstitutionalTrustGate = 'BLOCKED';

export interface InstitutionalTrustScoreInput {
  readonly operatorProfileId?: string;
  readonly sessionsObserved?: number;
  readonly disciplineScore?: number;
  readonly resilienceScore?: number;
  readonly impulsivityScore?: number;
  readonly tiltRiskScore?: number;
  readonly predictedFailureProbability?: number;
  readonly cooldownComplianceRate?: number;
  readonly vetoComplianceRate?: number;
  readonly recoverySessions?: number;
  readonly cooldownViolations?: number;
  readonly vetoViolations?: number;
  readonly manualOverrides?: number;
  readonly interruptions?: number;
  readonly recentFailurePredictions?: number;
}

export interface InstitutionalTrustScoreReport {
  readonly operatorProfileId: string;
  readonly trustState: InstitutionalTrustState;
  readonly trustScore: number;
  readonly trustSeedScore: number;
  readonly complianceScore: number;
  readonly penaltyScore: number;
  readonly recoveryCredit: number;
  readonly sessionsObserved: number;
  readonly requiresCooldown: boolean;
  readonly shouldRestrict: boolean;
  readonly shouldLock: boolean;
  readonly canSuggest: boolean;
  readonly gate: InstitutionalTrustGate;
  readonly operationalGate: InstitutionalTrustGate;
  readonly paperSessionGate: InstitutionalTrustGate;
  readonly liveSessionGate: InstitutionalTrustGate;
  readonly liveMoneyAuthorized: false;
  readonly reasons: readonly string[];
}

export class InstitutionalTrustScoreEngine {
  public evaluate(input: InstitutionalTrustScoreInput): InstitutionalTrustScoreReport {
    const normalized = this.normalize(input);

    const complianceScore = this.clamp(
      normalized.cooldownComplianceRate * 0.56 +
        normalized.vetoComplianceRate * 0.44,
      0,
      100
    );

    const trustSeedScore = this.clamp(
      normalized.disciplineScore * 0.28 +
        normalized.resilienceScore * 0.24 +
        normalized.cooldownComplianceRate * 0.18 +
        normalized.vetoComplianceRate * 0.14 +
        (100 - normalized.impulsivityScore) * 0.06 +
        (100 - normalized.tiltRiskScore) * 0.05 +
        (100 - normalized.predictedFailureProbability) * 0.05,
      0,
      100
    );

    const penaltyScore = this.clamp(
      normalized.cooldownViolations * 11 +
        normalized.vetoViolations * 13 +
        normalized.manualOverrides * 10 +
        normalized.interruptions * 25 +
        normalized.recentFailurePredictions * 6,
      0,
      100
    );

    const recoveryCredit = this.clamp(
      normalized.recoverySessions * 3,
      0,
      18
    );

    const trustScore = this.clamp(
      trustSeedScore - penaltyScore + recoveryCredit,
      0,
      100
    );

    const trustState = this.classify(
      normalized,
      trustScore,
      complianceScore
    );

    return Object.freeze({
      operatorProfileId: normalized.operatorProfileId,
      trustState,
      trustScore: this.round(trustScore),
      trustSeedScore: this.round(trustSeedScore),
      complianceScore: this.round(complianceScore),
      penaltyScore: this.round(penaltyScore),
      recoveryCredit: this.round(recoveryCredit),
      sessionsObserved: normalized.sessionsObserved,
      requiresCooldown: trustState === 'WATCHLIST' || trustState === 'RESTRICTED' || trustState === 'LOCKED',
      shouldRestrict: trustState === 'RESTRICTED' || trustState === 'LOCKED',
      shouldLock: trustState === 'LOCKED',
      canSuggest: trustState === 'TRUSTED' || trustState === 'STABLE',
      gate: 'BLOCKED',
      operationalGate: 'BLOCKED',
      paperSessionGate: 'BLOCKED',
      liveSessionGate: 'BLOCKED',
      liveMoneyAuthorized: false,
      reasons: this.reasonsFor(normalized, trustState, trustScore, penaltyScore, complianceScore)
    });
  }

  public analyze(input: InstitutionalTrustScoreInput): InstitutionalTrustScoreReport {
    return this.evaluate(input);
  }

  public execute(input: InstitutionalTrustScoreInput): InstitutionalTrustScoreReport {
    return this.evaluate(input);
  }

  private classify(
    input: Required<InstitutionalTrustScoreInput> & { readonly operatorProfileId: string },
    trustScore: number,
    complianceScore: number
  ): InstitutionalTrustState {
    if (input.sessionsObserved < 3) {
      return 'UNVERIFIED';
    }

    if (
      input.interruptions > 0 ||
      input.vetoViolations >= 2 ||
      trustScore < 25
    ) {
      return 'LOCKED';
    }

    if (
      trustScore < 45 ||
      input.cooldownViolations + input.vetoViolations + input.manualOverrides >= 3
    ) {
      return 'RESTRICTED';
    }

    if (
      trustScore < 65 ||
      input.predictedFailureProbability >= 65 ||
      input.tiltRiskScore >= 65 ||
      complianceScore < 70
    ) {
      return 'WATCHLIST';
    }

    if (
      trustScore >= 82 &&
      complianceScore >= 85 &&
      input.cooldownViolations === 0 &&
      input.vetoViolations === 0 &&
      input.manualOverrides === 0
    ) {
      return 'TRUSTED';
    }

    return 'STABLE';
  }

  private reasonsFor(
    input: Required<InstitutionalTrustScoreInput> & { readonly operatorProfileId: string },
    trustState: InstitutionalTrustState,
    trustScore: number,
    penaltyScore: number,
    complianceScore: number
  ): readonly string[] {
    const reasons: string[] = [`TRUST_STATE:${trustState}`];

    if (input.sessionsObserved < 3) reasons.push('INSUFFICIENT_TRUST_HISTORY');
    if (input.cooldownViolations > 0) reasons.push('COOLDOWN_VIOLATION_PENALTY');
    if (input.vetoViolations > 0) reasons.push('VETO_VIOLATION_PENALTY');
    if (input.manualOverrides > 0) reasons.push('MANUAL_OVERRIDE_PENALTY');
    if (input.interruptions > 0) reasons.push('SESSION_INTERRUPTION_PENALTY');
    if (input.recoverySessions > 0) reasons.push('RECOVERY_CREDIT_APPLIED');
    if (penaltyScore >= 30) reasons.push('HIGH_TRUST_PENALTY_PRESSURE');
    if (complianceScore < 70) reasons.push('LOW_COMPLIANCE_SCORE');
    if (trustScore < 45) reasons.push('LOW_TRUST_SCORE');
    if (input.predictedFailureProbability >= 65) reasons.push('PREDICTED_FAILURE_PRESSURE');

    reasons.push('LIVE_MONEY_AUTHORIZATION:FALSE');
    reasons.push('OPERATIONAL_GATE:BLOCKED');

    return Object.freeze(reasons);
  }

  private normalize(
    input: InstitutionalTrustScoreInput
  ): Required<InstitutionalTrustScoreInput> & { readonly operatorProfileId: string } {
    return Object.freeze({
      operatorProfileId: this.resolveId(input.operatorProfileId, 'anonymous-operator-profile'),
      sessionsObserved: this.nonNegativeInteger(input.sessionsObserved),
      disciplineScore: this.score(input.disciplineScore, 0),
      resilienceScore: this.score(input.resilienceScore, 0),
      impulsivityScore: this.score(input.impulsivityScore, 0),
      tiltRiskScore: this.score(input.tiltRiskScore, 0),
      predictedFailureProbability: this.score(input.predictedFailureProbability, 0),
      cooldownComplianceRate: this.score(input.cooldownComplianceRate, 100),
      vetoComplianceRate: this.score(input.vetoComplianceRate, 100),
      recoverySessions: this.nonNegativeInteger(input.recoverySessions),
      cooldownViolations: this.nonNegativeInteger(input.cooldownViolations),
      vetoViolations: this.nonNegativeInteger(input.vetoViolations),
      manualOverrides: this.nonNegativeInteger(input.manualOverrides),
      interruptions: this.nonNegativeInteger(input.interruptions),
      recentFailurePredictions: this.nonNegativeInteger(input.recentFailurePredictions)
    });
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
