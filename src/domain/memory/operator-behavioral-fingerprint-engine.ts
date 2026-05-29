export type OperatorBehaviorEventType =
  | 'WIN'
  | 'LOSS'
  | 'COOLDOWN_RESPECTED'
  | 'COOLDOWN_VIOLATED'
  | 'VETO_ACCEPTED'
  | 'VETO_IGNORED'
  | 'MANUAL_OVERRIDE'
  | 'WARNING_ACCEPTED'
  | 'RECOVERY_SIGNAL'
  | 'SESSION_INTERRUPTED'
  | 'ASSISTED_SUGGESTION';

export type OperatorBehavioralFingerprintState =
  | 'INSUFFICIENT_DATA'
  | 'DISCIPLINED'
  | 'BALANCED'
  | 'IMPULSIVE'
  | 'FATIGUE_PRONE'
  | 'OVERCONFIDENT'
  | 'TILT_PRONE'
  | 'RECOVERY_ORIENTED'
  | 'HIGH_RISK';

export type OperatorBehavioralFingerprintGate = 'BLOCKED';

export interface OperatorBehavioralFingerprintEvent {
  readonly eventId: string;
  readonly timestamp: number;
  readonly type: OperatorBehaviorEventType;
  readonly riskPressure?: number;
}

export interface OperatorBehavioralFingerprintInput {
  readonly operatorProfileId?: string;
  readonly sessionId?: string;
  readonly events: readonly OperatorBehavioralFingerprintEvent[];
}

export interface OperatorBehavioralFingerprintCounters {
  readonly wins: number;
  readonly losses: number;
  readonly cooldownsRespected: number;
  readonly cooldownsViolated: number;
  readonly vetoesAccepted: number;
  readonly vetoesIgnored: number;
  readonly manualOverrides: number;
  readonly warningsAccepted: number;
  readonly recoverySignals: number;
  readonly interruptions: number;
  readonly assistedSuggestions: number;
  readonly maxLossStreak: number;
}

export interface OperatorBehavioralFingerprintReport {
  readonly operatorProfileId: string;
  readonly sessionId: string;
  readonly eventsObserved: number;
  readonly fingerprintState: OperatorBehavioralFingerprintState;
  readonly disciplineScore: number;
  readonly impulsivityScore: number;
  readonly resilienceScore: number;
  readonly tiltRiskScore: number;
  readonly overconfidenceScore: number;
  readonly trustSeedScore: number;
  readonly memoryIntegrityScore: number;
  readonly highestRiskPressure: number;
  readonly counters: OperatorBehavioralFingerprintCounters;
  readonly gate: OperatorBehavioralFingerprintGate;
  readonly operationalGate: OperatorBehavioralFingerprintGate;
  readonly paperSessionGate: OperatorBehavioralFingerprintGate;
  readonly liveSessionGate: OperatorBehavioralFingerprintGate;
  readonly liveMoneyAuthorized: false;
  readonly reasons: readonly string[];
}

const MAX_FINGERPRINT_EVENTS = 900;
const MINIMUM_FINGERPRINT_EVENTS = 6;

export class OperatorBehavioralFingerprintEngine {
  public evaluate(
    input: OperatorBehavioralFingerprintInput
  ): OperatorBehavioralFingerprintReport {
    this.assertInput(input);

    const events = input.events.slice(0, MAX_FINGERPRINT_EVENTS);
    const operatorProfileId = this.resolveId(input.operatorProfileId, 'anonymous-operator-profile');
    const sessionId = this.resolveId(input.sessionId, 'operator-fingerprint-session');

    let wins = 0;
    let losses = 0;
    let cooldownsRespected = 0;
    let cooldownsViolated = 0;
    let vetoesAccepted = 0;
    let vetoesIgnored = 0;
    let manualOverrides = 0;
    let warningsAccepted = 0;
    let recoverySignals = 0;
    let interruptions = 0;
    let assistedSuggestions = 0;
    let currentLossStreak = 0;
    let maxLossStreak = 0;
    let highestRiskPressure = 0;
    let integrityPenalty = input.events.length > MAX_FINGERPRINT_EVENTS ? 10 : 0;
    let previousTimestamp = Number.NEGATIVE_INFINITY;

    for (let index = 0; index < events.length; index += 1) {
      const event = events[index];
      this.assertEvent(event);

      if (event.timestamp < previousTimestamp) {
        integrityPenalty += 8;
      }

      previousTimestamp = event.timestamp;
      highestRiskPressure = Math.max(highestRiskPressure, this.normalizeScore(event.riskPressure, 0));

      switch (event.type) {
        case 'WIN':
          wins += 1;
          currentLossStreak = 0;
          break;
        case 'LOSS':
          losses += 1;
          currentLossStreak += 1;
          maxLossStreak = Math.max(maxLossStreak, currentLossStreak);
          break;
        case 'COOLDOWN_RESPECTED':
          cooldownsRespected += 1;
          break;
        case 'COOLDOWN_VIOLATED':
          cooldownsViolated += 1;
          break;
        case 'VETO_ACCEPTED':
          vetoesAccepted += 1;
          break;
        case 'VETO_IGNORED':
          vetoesIgnored += 1;
          break;
        case 'MANUAL_OVERRIDE':
          manualOverrides += 1;
          break;
        case 'WARNING_ACCEPTED':
          warningsAccepted += 1;
          break;
        case 'RECOVERY_SIGNAL':
          recoverySignals += 1;
          currentLossStreak = 0;
          break;
        case 'SESSION_INTERRUPTED':
          interruptions += 1;
          break;
        case 'ASSISTED_SUGGESTION':
          assistedSuggestions += 1;
          break;
      }
    }

    const counters: OperatorBehavioralFingerprintCounters = Object.freeze({
      wins,
      losses,
      cooldownsRespected,
      cooldownsViolated,
      vetoesAccepted,
      vetoesIgnored,
      manualOverrides,
      warningsAccepted,
      recoverySignals,
      interruptions,
      assistedSuggestions,
      maxLossStreak
    });

    const disciplineScore = this.clamp(
      cooldownsRespected * 18 +
        vetoesAccepted * 17 +
        recoverySignals * 10 +
        wins * 4 -
        cooldownsViolated * 18 -
        vetoesIgnored * 18 -
        manualOverrides * 12,
      0,
      100
    );

    const impulsivityScore = this.clamp(
      cooldownsViolated * 20 +
        vetoesIgnored * 22 +
        manualOverrides * 16 +
        warningsAccepted * 9 +
        maxLossStreak * 6 -
        recoverySignals * 8,
      0,
      100
    );

    const resilienceScore = this.clamp(
      recoverySignals * 24 +
        cooldownsRespected * 10 +
        vetoesAccepted * 10 +
        wins * 4 -
        interruptions * 18 -
        maxLossStreak * 5,
      0,
      100
    );

    const tiltRiskScore = this.clamp(
      maxLossStreak * 11 +
        cooldownsViolated * 15 +
        vetoesIgnored * 16 +
        interruptions * 24 +
        Math.max(0, losses - wins) * 5 +
        highestRiskPressure * 0.18 -
        resilienceScore * 0.18,
      0,
      100
    );

    const overconfidenceScore = this.clamp(
      assistedSuggestions * 6 +
        wins * 5 +
        manualOverrides * 12 +
        warningsAccepted * 8 -
        vetoesAccepted * 10 -
        cooldownsRespected * 8,
      0,
      100
    );

    const trustSeedScore = this.clamp(
      disciplineScore * 0.42 +
        resilienceScore * 0.34 +
        (100 - impulsivityScore) * 0.14 +
        (100 - tiltRiskScore) * 0.10,
      0,
      100
    );

    const fingerprintState = this.classify(
      events.length,
      counters,
      disciplineScore,
      impulsivityScore,
      resilienceScore,
      tiltRiskScore,
      overconfidenceScore,
      trustSeedScore,
      highestRiskPressure
    );

    const memoryIntegrityScore = this.clamp(100 - integrityPenalty, 0, 100);

    return Object.freeze({
      operatorProfileId,
      sessionId,
      eventsObserved: events.length,
      fingerprintState,
      disciplineScore: this.round(disciplineScore),
      impulsivityScore: this.round(impulsivityScore),
      resilienceScore: this.round(resilienceScore),
      tiltRiskScore: this.round(tiltRiskScore),
      overconfidenceScore: this.round(overconfidenceScore),
      trustSeedScore: this.round(trustSeedScore),
      memoryIntegrityScore: this.round(memoryIntegrityScore),
      highestRiskPressure: this.round(highestRiskPressure),
      counters,
      gate: 'BLOCKED',
      operationalGate: 'BLOCKED',
      paperSessionGate: 'BLOCKED',
      liveSessionGate: 'BLOCKED',
      liveMoneyAuthorized: false,
      reasons: this.reasonsFor(fingerprintState, counters, trustSeedScore, impulsivityScore, tiltRiskScore)
    });
  }

  public analyze(input: OperatorBehavioralFingerprintInput): OperatorBehavioralFingerprintReport {
    return this.evaluate(input);
  }

  public execute(input: OperatorBehavioralFingerprintInput): OperatorBehavioralFingerprintReport {
    return this.evaluate(input);
  }

  private classify(
    eventsObserved: number,
    counters: OperatorBehavioralFingerprintCounters,
    disciplineScore: number,
    impulsivityScore: number,
    resilienceScore: number,
    tiltRiskScore: number,
    overconfidenceScore: number,
    trustSeedScore: number,
    highestRiskPressure: number
  ): OperatorBehavioralFingerprintState {
    if (eventsObserved < MINIMUM_FINGERPRINT_EVENTS) {
      return 'INSUFFICIENT_DATA';
    }

    if (counters.interruptions > 0) {
      return 'HIGH_RISK';
    }

    const disciplinedPattern =
      counters.cooldownsRespected >= 2 &&
      counters.vetoesAccepted >= 2 &&
      counters.cooldownsViolated === 0 &&
      counters.vetoesIgnored === 0 &&
      counters.manualOverrides === 0 &&
      disciplineScore >= 65;

    if (disciplinedPattern) {
      return 'DISCIPLINED';
    }

    const recoveryPattern =
      counters.recoverySignals >= 2 &&
      counters.cooldownsRespected >= 1 &&
      counters.vetoesAccepted >= 1 &&
      resilienceScore >= 60 &&
      impulsivityScore < 45;

    if (recoveryPattern) {
      return 'RECOVERY_ORIENTED';
    }

    const severeHighRiskPattern =
      (tiltRiskScore >= 88 && impulsivityScore >= 88 && highestRiskPressure >= 90) ||
      (trustSeedScore <= 15 && highestRiskPressure >= 92 && counters.maxLossStreak >= 3) ||
      (counters.cooldownsViolated >= 2 && counters.vetoesIgnored >= 2 && counters.manualOverrides >= 2);

    if (severeHighRiskPattern) {
      return 'HIGH_RISK';
    }

    if (tiltRiskScore >= 65 && impulsivityScore < 60) {
      return 'TILT_PRONE';
    }

    if (impulsivityScore >= 60) {
      return 'IMPULSIVE';
    }

    if (overconfidenceScore >= 65 && disciplineScore < 55) {
      return 'OVERCONFIDENT';
    }

    if (tiltRiskScore >= 45 && resilienceScore < 45) {
      return 'FATIGUE_PRONE';
    }

    return 'BALANCED';
  }

  private reasonsFor(
    state: OperatorBehavioralFingerprintState,
    counters: OperatorBehavioralFingerprintCounters,
    trustSeedScore: number,
    impulsivityScore: number,
    tiltRiskScore: number
  ): readonly string[] {
    const reasons: string[] = [`FINGERPRINT_STATE:${state}`];

    if (counters.cooldownsViolated > 0) reasons.push('COOLDOWN_VIOLATION_BEHAVIOR_DETECTED');
    if (counters.vetoesIgnored > 0) reasons.push('VETO_IGNORED_BEHAVIOR_DETECTED');
    if (counters.manualOverrides > 0) reasons.push('MANUAL_OVERRIDE_BEHAVIOR_DETECTED');
    if (counters.maxLossStreak >= 2) reasons.push('LOSS_STREAK_BEHAVIOR_PATTERN_DETECTED');
    if (counters.recoverySignals > 0) reasons.push('RECOVERY_BEHAVIOR_DETECTED');
    if (impulsivityScore >= 60) reasons.push('IMPULSIVITY_THRESHOLD_EXCEEDED');
    if (tiltRiskScore >= 65) reasons.push('TILT_RISK_THRESHOLD_EXCEEDED');
    if (trustSeedScore <= 35) reasons.push('LOW_TRUST_SEED_SCORE');

    reasons.push('LIVE_MONEY_AUTHORIZATION:FALSE');
    reasons.push('OPERATIONAL_GATE:BLOCKED');

    return Object.freeze(reasons);
  }

  private assertInput(input: OperatorBehavioralFingerprintInput): void {
    if (!Array.isArray(input.events)) {
      throw new Error('INVALID_OPERATOR_BEHAVIORAL_FINGERPRINT_EVENTS');
    }
  }

  private assertEvent(event: OperatorBehavioralFingerprintEvent): void {
    if (typeof event.eventId !== 'string' || event.eventId.trim().length === 0) {
      throw new Error('INVALID_OPERATOR_BEHAVIORAL_FINGERPRINT_EVENT_ID');
    }

    if (!Number.isFinite(event.timestamp) || event.timestamp < 0) {
      throw new Error('INVALID_OPERATOR_BEHAVIORAL_FINGERPRINT_TIMESTAMP');
    }

    if (!this.isKnownEventType(event.type)) {
      throw new Error('INVALID_OPERATOR_BEHAVIORAL_FINGERPRINT_EVENT_TYPE');
    }
  }

  private isKnownEventType(type: OperatorBehaviorEventType): boolean {
    switch (type) {
      case 'WIN':
      case 'LOSS':
      case 'COOLDOWN_RESPECTED':
      case 'COOLDOWN_VIOLATED':
      case 'VETO_ACCEPTED':
      case 'VETO_IGNORED':
      case 'MANUAL_OVERRIDE':
      case 'WARNING_ACCEPTED':
      case 'RECOVERY_SIGNAL':
      case 'SESSION_INTERRUPTED':
      case 'ASSISTED_SUGGESTION':
        return true;
      default:
        return false;
    }
  }

  private resolveId(value: string | undefined, fallback: string): string {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
  }

  private normalizeScore(value: number | undefined, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value)
      ? this.round(this.clamp(value, 0, 100))
      : fallback;
  }

  private clamp(value: number, minimum: number, maximum: number): number {
    return Math.min(maximum, Math.max(minimum, value));
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
