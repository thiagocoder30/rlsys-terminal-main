export type InstitutionalSessionRhythmStatus =
  | 'INSUFFICIENT_SAMPLE'
  | 'HEALTHY'
  | 'ACCELERATED'
  | 'EMOTIONAL'
  | 'IRRATIONAL'
  | 'COLLAPSING';

export type InstitutionalSessionRhythmState = InstitutionalSessionRhythmStatus;
export type InstitutionalSessionRhythmGate = 'BLOCKED';

export interface InstitutionalSessionRhythmInput {
  readonly [key: string]: unknown;
}

interface NormalizedRhythmInput {
  readonly sessionId: string;
  readonly spinsObserved: number;
  readonly averageSecondsBetweenSpins: number;
  readonly baselineSecondsBetweenSpins: number;
  readonly lossStreak: number;
  readonly cooldownViolations: number;
  readonly manualOverrideAttempts: number;
  readonly acceptedWarnings: number;
  readonly rejectedWarnings: number;
  readonly recoverySignals: number;
}

export interface InstitutionalSessionRhythmReport {
  readonly state: InstitutionalSessionRhythmStatus;
  readonly status: InstitutionalSessionRhythmStatus;
  readonly classification: InstitutionalSessionRhythmStatus;
  readonly sessionId: string;
  readonly rhythmScore: number;
  readonly score: number;
  readonly accelerationPressure: number;
  readonly emotionalPressure: number;
  readonly irrationalPressure: number;
  readonly collapsePressure: number;
  readonly requiresCooldown: boolean;
  readonly gate: InstitutionalSessionRhythmGate;
  readonly operationalGate: InstitutionalSessionRhythmGate;
  readonly cooldownRecommendation: 'REQUIRED' | 'NOT_REQUIRED';
  readonly recommendation: 'OBSERVE' | 'COOLDOWN' | 'STOP_SESSION';
  readonly reasons: readonly string[];
}

const MINIMUM_SAMPLE = 20;
const ACCELERATED_THRESHOLD = 30;
const EMOTIONAL_THRESHOLD = 45;
const IRRATIONAL_THRESHOLD = 68;
const COLLAPSING_THRESHOLD = 86;

export class InstitutionalSessionRhythmEngine {
  public evaluate(input: InstitutionalSessionRhythmInput): InstitutionalSessionRhythmReport {
    const normalized = this.normalize(input);

    if (normalized.spinsObserved < MINIMUM_SAMPLE) {
      return this.report(
        normalized.sessionId,
        'INSUFFICIENT_SAMPLE',
        100,
        0,
        0,
        0,
        0,
        false,
        ['INSUFFICIENT_SAMPLE_FOR_RHYTHM_ESCALATION']
      );
    }

    if (normalized.averageSecondsBetweenSpins > normalized.baselineSecondsBetweenSpins * 4) {
      return this.report(
        normalized.sessionId,
        'INSUFFICIENT_SAMPLE',
        100,
        0,
        0,
        0,
        0,
        false,
        ['INVALID_UNORDERED_SESSION_RHYTHM_INPUT']
      );
    }

    const accelerationPressure = this.clamp(
      ((normalized.baselineSecondsBetweenSpins - normalized.averageSecondsBetweenSpins) /
        normalized.baselineSecondsBetweenSpins) * 100,
      0,
      100
    );

    const emotionalPressure = this.clamp(
      normalized.lossStreak * 8 +
        normalized.acceptedWarnings * 9 -
        normalized.rejectedWarnings * 4 -
        normalized.recoverySignals * 10,
      0,
      100
    );

    const irrationalPressure = this.clamp(
      accelerationPressure * 0.2 +
        emotionalPressure * 0.35 +
        normalized.cooldownViolations * 12 +
        normalized.manualOverrideAttempts * 13,
      0,
      100
    );

    const collapsePressure = this.clamp(
      accelerationPressure * 0.18 +
        emotionalPressure * 0.24 +
        irrationalPressure * 0.38 +
        normalized.cooldownViolations * 10 +
        normalized.manualOverrideAttempts * 8 -
        normalized.recoverySignals * 12,
      0,
      100
    );

    const state = this.classify(
      normalized,
      accelerationPressure,
      emotionalPressure,
      irrationalPressure,
      collapsePressure
    );

    const rhythmScore = this.clamp(
      100 -
        accelerationPressure * 0.22 -
        emotionalPressure * 0.3 -
        irrationalPressure * 0.3 -
        collapsePressure * 0.18,
      0,
      100
    );

    return this.report(
      normalized.sessionId,
      state,
      rhythmScore,
      accelerationPressure,
      emotionalPressure,
      irrationalPressure,
      collapsePressure,
      state === 'IRRATIONAL' || state === 'COLLAPSING',
      this.explain(
        state,
        accelerationPressure,
        emotionalPressure,
        irrationalPressure,
        collapsePressure
      )
    );
  }

  public analyze(input: InstitutionalSessionRhythmInput): InstitutionalSessionRhythmReport {
    return this.evaluate(input);
  }

  public execute(input: InstitutionalSessionRhythmInput): InstitutionalSessionRhythmReport {
    return this.evaluate(input);
  }

  private normalize(input: InstitutionalSessionRhythmInput): NormalizedRhythmInput {
    const sessionIdValue = input.sessionId;

    const sessionId =
      typeof sessionIdValue === 'string' && sessionIdValue.trim().length > 0
        ? sessionIdValue.trim()
        : 'institutional-session-rhythm-runtime';

    const spinsObserved = this.numberFrom(
      input.spinsObserved,
      input.observedSpins,
      input.roundsObserved,
      input.observedRounds,
      input.totalRounds,
      input.roundCount,
      input.spinCount,
      input.sampleSize,
      input.observations
    );

    const baselineSecondsBetweenSpins = this.positiveNumberFrom(
      input.baselineSecondsBetweenSpins,
      input.baselineSecondsBetweenRounds,
      input.baselineIntervalSeconds,
      input.expectedSecondsBetweenSpins,
      input.expectedIntervalSeconds,
      input.normalSecondsBetweenSpins,
      input.baselineCadenceSeconds,
      35
    );

    const averageSecondsBetweenSpins = this.positiveNumberFrom(
      input.averageSecondsBetweenSpins,
      input.averageSecondsBetweenRounds,
      input.averageIntervalSeconds,
      input.avgIntervalSeconds,
      input.averageSpinIntervalSeconds,
      input.avgSecondsBetweenSpins,
      input.sessionAverageSeconds,
      input.currentIntervalSeconds,
      baselineSecondsBetweenSpins
    );

    return Object.freeze({
      sessionId,
      spinsObserved: Number.isFinite(spinsObserved) ? spinsObserved : 100,
      averageSecondsBetweenSpins,
      baselineSecondsBetweenSpins,
      lossStreak: this.nonNegativeNumberFrom(
        input.lossStreak,
        input.consecutiveLosses,
        input.lossesInARow,
        input.consecutiveLossStreak,
        0
      ),
      cooldownViolations: this.nonNegativeNumberFrom(
        input.cooldownViolations,
        input.cooldownBreaks,
        input.cooldownBreaches,
        input.ignoredCooldowns,
        input.cooldownIgnoredCount,
        0
      ),
      manualOverrideAttempts: this.nonNegativeNumberFrom(
        input.manualOverrideAttempts,
        input.overrideAttempts,
        input.manualOverrides,
        input.overrideCount,
        0
      ),
      acceptedWarnings: this.nonNegativeNumberFrom(
        input.acceptedWarnings,
        input.acceptedRiskWarnings,
        input.warningAcceptances,
        input.acceptedGuidanceCount,
        0
      ),
      rejectedWarnings: this.nonNegativeNumberFrom(
        input.rejectedWarnings,
        input.rejectedRiskWarnings,
        input.warningRejections,
        input.rejectedGuidanceCount,
        0
      ),
      recoverySignals: this.nonNegativeNumberFrom(
        input.recoverySignals,
        input.recoveryCount,
        input.recoveryEvents,
        input.recoveryAttempts,
        0
      )
    });
  }

  private classify(
    input: NormalizedRhythmInput,
    accelerationPressure: number,
    emotionalPressure: number,
    irrationalPressure: number,
    collapsePressure: number
  ): InstitutionalSessionRhythmStatus {
    const compoundedCollapse =
      collapsePressure >= COLLAPSING_THRESHOLD &&
      irrationalPressure >= IRRATIONAL_THRESHOLD &&
      emotionalPressure >= EMOTIONAL_THRESHOLD &&
      input.cooldownViolations >= 3 &&
      input.manualOverrideAttempts >= 3 &&
      input.recoverySignals === 0;

    if (compoundedCollapse) {
      return 'COLLAPSING';
    }

    if (irrationalPressure >= IRRATIONAL_THRESHOLD) {
      return 'IRRATIONAL';
    }

    if (emotionalPressure >= EMOTIONAL_THRESHOLD) {
      return 'EMOTIONAL';
    }

    if (accelerationPressure >= ACCELERATED_THRESHOLD) {
      return 'ACCELERATED';
    }

    return 'HEALTHY';
  }

  private explain(
    state: InstitutionalSessionRhythmStatus,
    accelerationPressure: number,
    emotionalPressure: number,
    irrationalPressure: number,
    collapsePressure: number
  ): readonly string[] {
    const reasons: string[] = [];

    if (state === 'INSUFFICIENT_SAMPLE') {
      reasons.push('INSUFFICIENT_SAMPLE_FOR_RHYTHM_ESCALATION');
      return Object.freeze(reasons);
    }

    if (state === 'HEALTHY') {
      reasons.push('SESSION_RHYTHM_WITHIN_DEFENSIVE_LIMITS');
    }

    if (accelerationPressure >= ACCELERATED_THRESHOLD) {
      reasons.push('SESSION_ACCELERATION_PRESSURE_DETECTED');
    }

    if (emotionalPressure >= EMOTIONAL_THRESHOLD) {
      reasons.push('EMOTIONAL_RHYTHM_PRESSURE_DETECTED');
    }

    if (irrationalPressure >= IRRATIONAL_THRESHOLD) {
      reasons.push('IRRATIONAL_OPERATIONAL_CADENCE_DETECTED');
    }

    if (collapsePressure >= COLLAPSING_THRESHOLD) {
      reasons.push('COMPOUNDED_COLLAPSE_PRESSURE_DETECTED');
    }

    return Object.freeze(reasons);
  }

  private report(
    sessionId: string,
    state: InstitutionalSessionRhythmStatus,
    rhythmScore: number,
    accelerationPressure: number,
    emotionalPressure: number,
    irrationalPressure: number,
    collapsePressure: number,
    requiresCooldown: boolean,
    reasons: readonly string[]
  ): InstitutionalSessionRhythmReport {
    const score = this.round(rhythmScore);

    return Object.freeze({
      state,
      status: state,
      classification: state,
      sessionId,
      rhythmScore: score,
      score,
      accelerationPressure: this.round(accelerationPressure),
      emotionalPressure: this.round(emotionalPressure),
      irrationalPressure: this.round(irrationalPressure),
      collapsePressure: this.round(collapsePressure),
      requiresCooldown,
      gate: 'BLOCKED',
      operationalGate: 'BLOCKED',
      cooldownRecommendation: requiresCooldown ? 'REQUIRED' : 'NOT_REQUIRED',
      recommendation:
        state === 'COLLAPSING'
          ? 'STOP_SESSION'
          : state === 'IRRATIONAL'
            ? 'COOLDOWN'
            : 'OBSERVE',
      reasons
    });
  }

  private numberFrom(...values: readonly unknown[]): number {
    for (const value of values) {
      if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
      }

      if (typeof value === 'string' && value.trim().length > 0) {
        const parsed = Number(value);

        if (Number.isFinite(parsed)) {
          return parsed;
        }
      }
    }

    return Number.NaN;
  }

  private positiveNumberFrom(...values: readonly unknown[]): number {
    const value = this.numberFrom(...values);
    return Number.isFinite(value) && value > 0 ? value : 35;
  }

  private nonNegativeNumberFrom(...values: readonly unknown[]): number {
    const value = this.numberFrom(...values);
    return Number.isFinite(value) && value >= 0 ? value : 0;
  }

  private clamp(value: number, minimum: number, maximum: number): number {
    return Math.min(maximum, Math.max(minimum, value));
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
