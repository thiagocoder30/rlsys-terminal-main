export type OperatorBehaviorAction =
  | 'PREPARE'
  | 'OPEN_PAPER'
  | 'SETTLE_WIN'
  | 'SETTLE_LOSS'
  | 'SETTLE_PUSH'
  | 'SNAPSHOT'
  | 'RECOVER'
  | 'FINISH'
  | 'STATUS';

export type OperatorBehaviorReadiness =
  | 'OPERATOR_STABLE'
  | 'OPERATOR_OBSERVE'
  | 'OPERATOR_COOLDOWN'
  | 'OPERATOR_BLOCKED';

export type OperatorBehaviorReason =
  | 'OPERATOR_BEHAVIOR_ANALYZED'
  | 'INVALID_OPERATOR_BEHAVIOR_INPUT'
  | 'LIVE_MONEY_FORBIDDEN';

export interface OperatorBehaviorEvent {
  readonly eventId: string;
  readonly action: OperatorBehaviorAction;
  readonly occurredAtEpochMs: number;
  readonly result?: 'WIN' | 'LOSS' | 'PUSH';
  readonly productionMoneyAllowed?: boolean;
  readonly liveMoneyAuthorization?: boolean;
}

export interface OperatorBehaviorPolicy {
  readonly maxActionsPerMinute: number;
  readonly maxConsecutiveLossesBeforeCooldown: number;
  readonly maxRevengeWindowMs: number;
  readonly maxRecoveryCount: number;
  readonly maxRiskScoreForStable: number;
  readonly maxRiskScoreForObserve: number;
  readonly maxRiskScoreForCooldown: number;
}

export interface OperatorBehaviorMonitorInput {
  readonly operatorId: string;
  readonly sessionId: string;
  readonly events: readonly OperatorBehaviorEvent[];
  readonly policy: OperatorBehaviorPolicy;
  readonly productionMoneyAllowed?: boolean;
  readonly liveMoneyAuthorization?: boolean;
}

export interface OperatorBehaviorReport {
  readonly operatorId: string;
  readonly sessionId: string;
  readonly totalEvents: number;
  readonly actionBursts: number;
  readonly consecutiveLosses: number;
  readonly maxConsecutiveLosses: number;
  readonly revengePatternCount: number;
  readonly recoveryCount: number;
  readonly overtradingScore: number;
  readonly tiltScore: number;
  readonly disciplineScore: number;
  readonly riskScore: number;
  readonly readiness: OperatorBehaviorReadiness;
  readonly productionMoneyAllowed: false;
  readonly liveMoneyAuthorization: false;
  readonly explanation: string;
}

export type OperatorBehaviorMonitorResult =
  | {
      readonly ok: true;
      readonly value: OperatorBehaviorReport;
    }
  | {
      readonly ok: false;
      readonly error: {
        readonly reason: OperatorBehaviorReason;
        readonly message: string;
        readonly productionMoneyAllowed: false;
        readonly liveMoneyAuthorization: false;
      };
    };

const SCORE_PRECISION = 10_000;

/**
 * OperatorBehaviorMonitor
 *
 * Monitora disciplina operacional PAPER: tilt, overtrading, revenge pattern,
 * uso excessivo de recovery e sequência de perdas.
 *
 * Este componente não executa aposta, não sugere lucro e não abre live money.
 * Ele apenas classifica a prontidão comportamental do operador.
 *
 * Complexidade: O(n), memória O(1), adequada ao baseline A10s/Helio P22.
 */
export class OperatorBehaviorMonitor {
  public evaluate(input: OperatorBehaviorMonitorInput): OperatorBehaviorMonitorResult {
    if (input.productionMoneyAllowed === true || input.liveMoneyAuthorization === true) {
      return this.fail('LIVE_MONEY_FORBIDDEN', 'Operator behavior monitor cannot run with live money flags enabled.');
    }

    if (Array.isArray(input.events)) {
      for (const event of input.events) {
        if (event.productionMoneyAllowed === true || event.liveMoneyAuthorization === true) {
          return this.fail('LIVE_MONEY_FORBIDDEN', 'Operator behavior event cannot contain live money flags.');
        }
      }
    }

    const invalidReason = this.validateInput(input);

    if (invalidReason !== null) {
      return this.fail('INVALID_OPERATOR_BEHAVIOR_INPUT', invalidReason);
    }

    let previousTimestamp = 0;
    let currentMinuteStart = input.events[0].occurredAtEpochMs;
    let actionsInMinute = 0;
    let actionBursts = 0;
    let consecutiveLosses = 0;
    let maxConsecutiveLosses = 0;
    let lastLossAt = 0;
    let revengePatternCount = 0;
    let recoveryCount = 0;
    let disciplineCredits = 0;

    for (const event of input.events) {
      if (event.occurredAtEpochMs < previousTimestamp) {
        return this.fail('INVALID_OPERATOR_BEHAVIOR_INPUT', 'events must be ordered by occurredAtEpochMs.');
      }

      previousTimestamp = event.occurredAtEpochMs;

      if (event.occurredAtEpochMs - currentMinuteStart <= 60_000) {
        actionsInMinute += 1;
      } else {
        if (actionsInMinute > input.policy.maxActionsPerMinute) {
          actionBursts += 1;
        }

        currentMinuteStart = event.occurredAtEpochMs;
        actionsInMinute = 1;
      }

      if (event.action === 'RECOVER') {
        recoveryCount += 1;
      }

      if (event.action === 'OPEN_PAPER' && lastLossAt > 0 && event.occurredAtEpochMs - lastLossAt <= input.policy.maxRevengeWindowMs) {
        revengePatternCount += 1;
      }

      if (event.result === 'LOSS') {
        consecutiveLosses += 1;
        lastLossAt = event.occurredAtEpochMs;
      } else if (event.result === 'WIN' || event.result === 'PUSH') {
        if (consecutiveLosses === 0) {
          disciplineCredits += 1;
        }

        consecutiveLosses = 0;
      }

      if (consecutiveLosses > maxConsecutiveLosses) {
        maxConsecutiveLosses = consecutiveLosses;
      }
    }

    if (actionsInMinute > input.policy.maxActionsPerMinute) {
      actionBursts += 1;
    }

    const totalEvents = input.events.length;
    const overtradingScore = this.clamp01(actionBursts / Math.max(1, totalEvents / input.policy.maxActionsPerMinute));
    const tiltScore = this.clamp01(
      (maxConsecutiveLosses / Math.max(1, input.policy.maxConsecutiveLossesBeforeCooldown)) * 0.45 +
      (revengePatternCount / Math.max(1, totalEvents)) * 0.35 +
      (recoveryCount / Math.max(1, input.policy.maxRecoveryCount)) * 0.20,
    );
    const disciplineScore = this.clamp01(1 - ((tiltScore * 0.65) + (overtradingScore * 0.35)) + (disciplineCredits / Math.max(20, totalEvents)) * 0.05);
    const riskScore = this.clamp01((tiltScore * 0.60) + (overtradingScore * 0.25) + ((1 - disciplineScore) * 0.15));
    const readiness = this.classify(input.policy, riskScore, maxConsecutiveLosses, recoveryCount);

    return {
      ok: true,
      value: {
        operatorId: input.operatorId,
        sessionId: input.sessionId,
        totalEvents,
        actionBursts,
        consecutiveLosses,
        maxConsecutiveLosses,
        revengePatternCount,
        recoveryCount,
        overtradingScore: this.roundScore(overtradingScore),
        tiltScore: this.roundScore(tiltScore),
        disciplineScore: this.roundScore(disciplineScore),
        riskScore: this.roundScore(riskScore),
        readiness,
        productionMoneyAllowed: false,
        liveMoneyAuthorization: false,
        explanation: this.explain(readiness),
      },
    };
  }

  private classify(
    policy: OperatorBehaviorPolicy,
    riskScore: number,
    maxConsecutiveLosses: number,
    recoveryCount: number,
  ): OperatorBehaviorReadiness {
    if (
      maxConsecutiveLosses > policy.maxConsecutiveLossesBeforeCooldown ||
      recoveryCount > policy.maxRecoveryCount ||
      riskScore > policy.maxRiskScoreForCooldown
    ) {
      return 'OPERATOR_BLOCKED';
    }

    if (riskScore > policy.maxRiskScoreForObserve) {
      return 'OPERATOR_COOLDOWN';
    }

    if (riskScore > policy.maxRiskScoreForStable) {
      return 'OPERATOR_OBSERVE';
    }

    return 'OPERATOR_STABLE';
  }

  private explain(readiness: OperatorBehaviorReadiness): string {
    if (readiness === 'OPERATOR_STABLE') {
      return 'Operador estável para observação PAPER supervisionada.';
    }

    if (readiness === 'OPERATOR_OBSERVE') {
      return 'Operador requer observação por sinais leves de pressão comportamental.';
    }

    if (readiness === 'OPERATOR_COOLDOWN') {
      return 'Operador deve entrar em cooldown operacional antes de nova decisão PAPER.';
    }

    return 'Operador bloqueado por risco comportamental elevado.';
  }

  private validateInput(input: OperatorBehaviorMonitorInput): string | null {
    if (typeof input !== 'object' || input === null) {
      return 'input must be an object.';
    }

    if (!this.isSafeToken(input.operatorId, 3, 96)) {
      return 'operatorId must be a safe token with 3 to 96 characters.';
    }

    if (!this.isSafeToken(input.sessionId, 3, 96)) {
      return 'sessionId must be a safe token with 3 to 96 characters.';
    }

    if (!Array.isArray(input.events) || input.events.length === 0 || input.events.length > 5000) {
      return 'events must contain 1 to 5000 behavior events.';
    }

    for (const event of input.events) {
      const eventValidation = this.validateEvent(event);

      if (eventValidation !== null) {
        return eventValidation;
      }
    }

    if (typeof input.policy !== 'object' || input.policy === null) {
      return 'policy must be provided.';
    }

    if (!Number.isInteger(input.policy.maxActionsPerMinute) || input.policy.maxActionsPerMinute < 1) {
      return 'policy.maxActionsPerMinute must be a positive integer.';
    }

    if (!Number.isInteger(input.policy.maxConsecutiveLossesBeforeCooldown) || input.policy.maxConsecutiveLossesBeforeCooldown < 1) {
      return 'policy.maxConsecutiveLossesBeforeCooldown must be a positive integer.';
    }

    if (!Number.isInteger(input.policy.maxRevengeWindowMs) || input.policy.maxRevengeWindowMs < 1) {
      return 'policy.maxRevengeWindowMs must be a positive integer.';
    }

    if (!Number.isInteger(input.policy.maxRecoveryCount) || input.policy.maxRecoveryCount < 0) {
      return 'policy.maxRecoveryCount must be a non-negative integer.';
    }

    if (!this.isScore(input.policy.maxRiskScoreForStable) || !this.isScore(input.policy.maxRiskScoreForObserve) || !this.isScore(input.policy.maxRiskScoreForCooldown)) {
      return 'risk thresholds must be finite scores between 0 and 1.';
    }

    if (
      input.policy.maxRiskScoreForStable >= input.policy.maxRiskScoreForObserve ||
      input.policy.maxRiskScoreForObserve >= input.policy.maxRiskScoreForCooldown
    ) {
      return 'risk thresholds must be strictly increasing.';
    }

    return null;
  }

  private validateEvent(event: OperatorBehaviorEvent): string | null {
    if (typeof event !== 'object' || event === null) {
      return 'each event must be an object.';
    }

    if (!this.isSafeToken(event.eventId, 3, 128)) {
      return 'event.eventId must be a safe token with 3 to 128 characters.';
    }

    if (!this.isKnownAction(event.action)) {
      return 'event.action is invalid.';
    }

    if (!Number.isInteger(event.occurredAtEpochMs) || event.occurredAtEpochMs <= 0) {
      return 'event.occurredAtEpochMs must be a positive integer.';
    }

    if (
      event.result !== undefined &&
      event.result !== 'WIN' &&
      event.result !== 'LOSS' &&
      event.result !== 'PUSH'
    ) {
      return 'event.result must be WIN, LOSS, or PUSH when provided.';
    }

    return null;
  }

  private isKnownAction(action: OperatorBehaviorAction): boolean {
    return (
      action === 'PREPARE' ||
      action === 'OPEN_PAPER' ||
      action === 'SETTLE_WIN' ||
      action === 'SETTLE_LOSS' ||
      action === 'SETTLE_PUSH' ||
      action === 'SNAPSHOT' ||
      action === 'RECOVER' ||
      action === 'FINISH' ||
      action === 'STATUS'
    );
  }

  private isScore(value: number): boolean {
    return Number.isFinite(value) && value >= 0 && value <= 1;
  }

  private clamp01(value: number): number {
    return Math.max(0, Math.min(1, value));
  }

  private roundScore(value: number): number {
    return Math.round(value * SCORE_PRECISION) / SCORE_PRECISION;
  }

  private isSafeToken(value: unknown, min: number, max: number): value is string {
    return (
      typeof value === 'string' &&
      value.length >= min &&
      value.length <= max &&
      /^[0-9A-Za-z._:-]+$/.test(value)
    );
  }

  private fail(reason: OperatorBehaviorReason, message: string): OperatorBehaviorMonitorResult {
    return {
      ok: false,
      error: {
        reason,
        message,
        productionMoneyAllowed: false,
        liveMoneyAuthorization: false,
      },
    };
  }
}
