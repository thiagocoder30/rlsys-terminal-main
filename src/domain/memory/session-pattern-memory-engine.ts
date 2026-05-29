export type SessionPatternEventType =
  | 'WIN'
  | 'LOSS'
  | 'ASSISTED_SUGGESTION'
  | 'SUPERVISOR_VETO'
  | 'COOLDOWN_TRIGGERED'
  | 'SESSION_INTERRUPTED'
  | 'WARNING_ACCEPTED'
  | 'OPERATOR_TILT'
  | 'RHYTHM_ACCELERATION'
  | 'RECOVERY_SIGNAL';

export type SessionPatternState =
  | 'INSUFFICIENT_DATA'
  | 'STABLE'
  | 'CAUTION'
  | 'DEGRADING'
  | 'FAILURE_PRONE'
  | 'COLLAPSED';

export type SessionPatternGate = 'BLOCKED';

export interface SessionPatternMemoryEvent {
  readonly eventId: string;
  readonly timestamp: number;
  readonly type: SessionPatternEventType;
  readonly riskPressure?: number;
  readonly evidenceScore?: number;
}

export interface SessionPatternMemoryInput {
  readonly sessionId?: string;
  readonly operatorProfileId?: string;
  readonly events: readonly SessionPatternMemoryEvent[];
}

export interface SessionPatternMemoryCounters {
  readonly wins: number;
  readonly losses: number;
  readonly assistedSuggestions: number;
  readonly vetoes: number;
  readonly cooldowns: number;
  readonly interruptions: number;
  readonly warningAcceptances: number;
  readonly tiltSignals: number;
  readonly rhythmAccelerations: number;
  readonly recoverySignals: number;
  readonly maxLossStreak: number;
}

export interface SessionPatternMemoryReport {
  readonly sessionId: string;
  readonly operatorProfileId: string;
  readonly eventsObserved: number;
  readonly patternState: SessionPatternState;
  readonly degradationScore: number;
  readonly failureRiskScore: number;
  readonly recoveryScore: number;
  readonly memoryIntegrityScore: number;
  readonly highestRiskPressure: number;
  readonly counters: SessionPatternMemoryCounters;
  readonly gate: SessionPatternGate;
  readonly operationalGate: SessionPatternGate;
  readonly paperSessionGate: SessionPatternGate;
  readonly liveSessionGate: SessionPatternGate;
  readonly liveMoneyAuthorized: false;
  readonly reasons: readonly string[];
}

const MAX_MEMORY_EVENTS = 800;
const MINIMUM_PATTERN_EVENTS = 5;

export class SessionPatternMemoryEngine {
  public analyze(input: SessionPatternMemoryInput): SessionPatternMemoryReport {
    this.assertInput(input);

    const sessionId = this.resolveId(input.sessionId, 'session-pattern-memory-runtime');
    const operatorProfileId = this.resolveId(input.operatorProfileId, 'anonymous-operator-profile');
    const events = input.events.slice(0, MAX_MEMORY_EVENTS);

    let wins = 0;
    let losses = 0;
    let assistedSuggestions = 0;
    let vetoes = 0;
    let cooldowns = 0;
    let interruptions = 0;
    let warningAcceptances = 0;
    let tiltSignals = 0;
    let rhythmAccelerations = 0;
    let recoverySignals = 0;
    let currentLossStreak = 0;
    let maxLossStreak = 0;
    let highestRiskPressure = 0;
    let integrityPenalty = input.events.length > MAX_MEMORY_EVENTS ? 10 : 0;
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
        case 'ASSISTED_SUGGESTION':
          assistedSuggestions += 1;
          break;
        case 'SUPERVISOR_VETO':
          vetoes += 1;
          break;
        case 'COOLDOWN_TRIGGERED':
          cooldowns += 1;
          break;
        case 'SESSION_INTERRUPTED':
          interruptions += 1;
          break;
        case 'WARNING_ACCEPTED':
          warningAcceptances += 1;
          break;
        case 'OPERATOR_TILT':
          tiltSignals += 1;
          break;
        case 'RHYTHM_ACCELERATION':
          rhythmAccelerations += 1;
          break;
        case 'RECOVERY_SIGNAL':
          recoverySignals += 1;
          currentLossStreak = 0;
          break;
      }
    }

    const counters: SessionPatternMemoryCounters = Object.freeze({
      wins,
      losses,
      assistedSuggestions,
      vetoes,
      cooldowns,
      interruptions,
      warningAcceptances,
      tiltSignals,
      rhythmAccelerations,
      recoverySignals,
      maxLossStreak
    });

    const recoveryScore = this.clamp(recoverySignals * 18 + wins * 4 - cooldowns * 5, 0, 100);

    const degradationScore = this.clamp(
      maxLossStreak * 11 +
        vetoes * 9 +
        cooldowns * 10 +
        warningAcceptances * 8 +
        tiltSignals * 13 +
        rhythmAccelerations * 7 -
        recoveryScore * 0.25,
      0,
      100
    );

    const failureRiskScore = this.clamp(
      degradationScore * 0.55 +
        highestRiskPressure * 0.25 +
        interruptions * 30 +
        Math.max(0, losses - wins) * 4 -
        recoveryScore * 0.15,
      0,
      100
    );

    const patternState = this.classify(
      events.length,
      counters,
      degradationScore,
      failureRiskScore,
      highestRiskPressure
    );

    const memoryIntegrityScore = this.clamp(100 - integrityPenalty, 0, 100);

    return Object.freeze({
      sessionId,
      operatorProfileId,
      eventsObserved: events.length,
      patternState,
      degradationScore: this.round(degradationScore),
      failureRiskScore: this.round(failureRiskScore),
      recoveryScore: this.round(recoveryScore),
      memoryIntegrityScore: this.round(memoryIntegrityScore),
      highestRiskPressure: this.round(highestRiskPressure),
      counters,
      gate: 'BLOCKED',
      operationalGate: 'BLOCKED',
      paperSessionGate: 'BLOCKED',
      liveSessionGate: 'BLOCKED',
      liveMoneyAuthorized: false,
      reasons: this.reasonsFor(patternState, counters, degradationScore, failureRiskScore)
    });
  }

  public evaluate(input: SessionPatternMemoryInput): SessionPatternMemoryReport {
    return this.analyze(input);
  }

  public execute(input: SessionPatternMemoryInput): SessionPatternMemoryReport {
    return this.analyze(input);
  }

  private classify(
    eventsObserved: number,
    counters: SessionPatternMemoryCounters,
    degradationScore: number,
    failureRiskScore: number,
    highestRiskPressure: number
  ): SessionPatternState {
    if (eventsObserved < MINIMUM_PATTERN_EVENTS) {
      return 'INSUFFICIENT_DATA';
    }

    if (counters.interruptions > 0 || failureRiskScore >= 88) {
      return 'COLLAPSED';
    }

    const compoundedFailurePattern =
      highestRiskPressure >= 85 &&
      (
        (counters.vetoes > 0 && counters.cooldowns > 0) ||
        (counters.cooldowns > 0 && counters.tiltSignals > 0) ||
        (counters.maxLossStreak >= 2 && counters.tiltSignals > 0)
      );

    if (failureRiskScore >= 70 || compoundedFailurePattern) {
      return 'FAILURE_PRONE';
    }

    if (degradationScore >= 45) {
      return 'DEGRADING';
    }

    if (
      counters.maxLossStreak >= 2 ||
      counters.warningAcceptances > 0 ||
      counters.vetoes > 0 ||
      counters.cooldowns > 0 ||
      counters.rhythmAccelerations > 0
    ) {
      return 'CAUTION';
    }

    return 'STABLE';
  }

  private reasonsFor(
    patternState: SessionPatternState,
    counters: SessionPatternMemoryCounters,
    degradationScore: number,
    failureRiskScore: number
  ): readonly string[] {
    const reasons: string[] = [`PATTERN_STATE:${patternState}`];

    if (counters.maxLossStreak >= 2) reasons.push('LOSS_STREAK_PATTERN_DETECTED');
    if (counters.warningAcceptances > 0) reasons.push('WARNING_ACCEPTANCE_PATTERN_DETECTED');
    if (counters.vetoes > 0) reasons.push('SUPERVISOR_VETO_PATTERN_DETECTED');
    if (counters.cooldowns > 0) reasons.push('COOLDOWN_PATTERN_DETECTED');
    if (counters.tiltSignals > 0) reasons.push('TILT_PATTERN_DETECTED');
    if (counters.interruptions > 0) reasons.push('TERMINAL_INTERRUPTION_PATTERN_DETECTED');
    if (degradationScore >= 45) reasons.push('SESSION_DEGRADATION_PATTERN_DETECTED');

    if (failureRiskScore >= 70 || patternState === 'FAILURE_PRONE') {
      reasons.push('CONTEXTUAL_FAILURE_RISK_PATTERN_DETECTED');
    }

    reasons.push('LIVE_MONEY_AUTHORIZATION:FALSE');
    reasons.push('OPERATIONAL_GATE:BLOCKED');

    return Object.freeze(reasons);
  }

  private assertInput(input: SessionPatternMemoryInput): void {
    if (!Array.isArray(input.events)) {
      throw new Error('INVALID_SESSION_PATTERN_MEMORY_EVENTS');
    }
  }

  private assertEvent(event: SessionPatternMemoryEvent): void {
    if (typeof event.eventId !== 'string' || event.eventId.trim().length === 0) {
      throw new Error('INVALID_SESSION_PATTERN_MEMORY_EVENT_ID');
    }

    if (!Number.isFinite(event.timestamp) || event.timestamp < 0) {
      throw new Error('INVALID_SESSION_PATTERN_MEMORY_TIMESTAMP');
    }

    if (!this.isKnownEventType(event.type)) {
      throw new Error('INVALID_SESSION_PATTERN_MEMORY_EVENT_TYPE');
    }
  }

  private isKnownEventType(type: SessionPatternEventType): boolean {
    switch (type) {
      case 'WIN':
      case 'LOSS':
      case 'ASSISTED_SUGGESTION':
      case 'SUPERVISOR_VETO':
      case 'COOLDOWN_TRIGGERED':
      case 'SESSION_INTERRUPTED':
      case 'WARNING_ACCEPTED':
      case 'OPERATOR_TILT':
      case 'RHYTHM_ACCELERATION':
      case 'RECOVERY_SIGNAL':
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
