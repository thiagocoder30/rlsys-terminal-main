export type CircuitBreakerStatus =
  | 'SESSION_OPEN'
  | 'SESSION_REVIEW'
  | 'SESSION_LOCKED'
  | 'SESSION_PROFIT_LOCKED'
  | 'BLOCKED';

export type RuntimeSanityStatus =
  | 'SANITY_OK'
  | 'SANITY_REVIEW'
  | 'PARADIGM_BREAK'
  | 'BLOCKED';

export interface CircuitBreakerInput {
  readonly initialBankroll: number;
  readonly currentBankroll: number;
  readonly stopLossAmount: number;
  readonly stopWinAmount: number;
  readonly recentLossAmount: number;
  readonly recentWindowSpins: number;
  readonly maxRecentLossAmount: number;
  readonly runtimeSanityStatus: RuntimeSanityStatus;
  readonly dataIntegrityOk: boolean;
  readonly cooldownActive: boolean;
}

export interface CircuitBreakerDecision {
  readonly status: CircuitBreakerStatus;
  readonly locked: boolean;
  readonly reason: string;
  readonly pnl: number;
  readonly drawdownAmount: number;
  readonly profitAmount: number;
  readonly drawdownRatio: number;
  readonly requiresCooldown: boolean;
}

export interface ResultSuccess<T> {
  readonly ok: true;
  readonly value: T;
}

export interface ResultFailure {
  readonly ok: false;
  readonly error: string;
}

export type Result<T> = ResultSuccess<T> | ResultFailure;

const MIN_BANKROLL = 1;
const MIN_WINDOW_SPINS = 1;

export class SessionCircuitBreaker {
  public evaluate(
    input: CircuitBreakerInput
  ): Result<CircuitBreakerDecision> {
    if (!this.isValidInput(input)) {
      return {
        ok: false,
        error: 'INVALID_CIRCUIT_BREAKER_INPUT'
      };
    }

    const pnl = input.currentBankroll - input.initialBankroll;
    const drawdownAmount = Math.max(0, -pnl);
    const profitAmount = Math.max(0, pnl);
    const drawdownRatio = drawdownAmount / input.initialBankroll;

    if (!input.dataIntegrityOk) {
      return this.success({
        status: 'SESSION_LOCKED',
        locked: true,
        reason: 'DATA_INTEGRITY_FAILURE',
        pnl,
        drawdownAmount,
        profitAmount,
        drawdownRatio,
        requiresCooldown: true
      });
    }

    if (
      input.runtimeSanityStatus === 'PARADIGM_BREAK' ||
      input.runtimeSanityStatus === 'BLOCKED'
    ) {
      return this.success({
        status: 'SESSION_LOCKED',
        locked: true,
        reason: 'RUNTIME_SANITY_BREAK',
        pnl,
        drawdownAmount,
        profitAmount,
        drawdownRatio,
        requiresCooldown: true
      });
    }

    if (input.cooldownActive) {
      return this.success({
        status: 'SESSION_LOCKED',
        locked: true,
        reason: 'COOLDOWN_ACTIVE',
        pnl,
        drawdownAmount,
        profitAmount,
        drawdownRatio,
        requiresCooldown: true
      });
    }

    if (drawdownAmount >= input.stopLossAmount) {
      return this.success({
        status: 'SESSION_LOCKED',
        locked: true,
        reason: 'STOP_LOSS_REACHED',
        pnl,
        drawdownAmount,
        profitAmount,
        drawdownRatio,
        requiresCooldown: true
      });
    }

    if (profitAmount >= input.stopWinAmount) {
      return this.success({
        status: 'SESSION_PROFIT_LOCKED',
        locked: true,
        reason: 'STOP_WIN_REACHED',
        pnl,
        drawdownAmount,
        profitAmount,
        drawdownRatio,
        requiresCooldown: false
      });
    }

    if (
      input.runtimeSanityStatus === 'SANITY_REVIEW' ||
      input.recentLossAmount >= input.maxRecentLossAmount
    ) {
      return this.success({
        status: 'SESSION_REVIEW',
        locked: false,
        reason: 'RISK_REVIEW_REQUIRED',
        pnl,
        drawdownAmount,
        profitAmount,
        drawdownRatio,
        requiresCooldown: false
      });
    }

    return this.success({
      status: 'SESSION_OPEN',
      locked: false,
      reason: 'SESSION_WITHIN_RISK_BUDGET',
      pnl,
      drawdownAmount,
      profitAmount,
      drawdownRatio,
      requiresCooldown: false
    });
  }

  private isValidInput(input: CircuitBreakerInput): boolean {
    if (typeof input !== 'object' || input === null) {
      return false;
    }

    if (!this.isPositiveFinite(input.initialBankroll)) {
      return false;
    }

    if (input.initialBankroll < MIN_BANKROLL) {
      return false;
    }

    if (!this.isNonNegativeFinite(input.currentBankroll)) {
      return false;
    }

    if (!this.isPositiveFinite(input.stopLossAmount)) {
      return false;
    }

    if (!this.isPositiveFinite(input.stopWinAmount)) {
      return false;
    }

    if (!this.isNonNegativeFinite(input.recentLossAmount)) {
      return false;
    }

    if (!Number.isInteger(input.recentWindowSpins)) {
      return false;
    }

    if (input.recentWindowSpins < MIN_WINDOW_SPINS) {
      return false;
    }

    if (!this.isPositiveFinite(input.maxRecentLossAmount)) {
      return false;
    }

    if (!this.isRuntimeSanityStatus(input.runtimeSanityStatus)) {
      return false;
    }

    return (
      typeof input.dataIntegrityOk === 'boolean' &&
      typeof input.cooldownActive === 'boolean'
    );
  }

  private isRuntimeSanityStatus(
    value: string
  ): value is RuntimeSanityStatus {
    return (
      value === 'SANITY_OK' ||
      value === 'SANITY_REVIEW' ||
      value === 'PARADIGM_BREAK' ||
      value === 'BLOCKED'
    );
