export type RuntimeEnforcementVerdict =
  | 'ALLOW'
  | 'NO_GO'
  | 'REVIEW'
  | 'FREEZE'
  | 'LOCKED'
  | 'BLOCKED';

export type RuntimeSanityState =
  | 'SANITY_OK'
  | 'SANITY_REVIEW'
  | 'PARADIGM_BREAK'
  | 'BLOCKED';

export type SessionBreakerState =
  | 'SESSION_OPEN'
  | 'SESSION_REVIEW'
  | 'SESSION_LOCKED'
  | 'SESSION_PROFIT_LOCKED'
  | 'BLOCKED';

export type DrawdownLockState =
  | 'DRAWDOWN_OK'
  | 'DRAWDOWN_REVIEW'
  | 'DRAWDOWN_LOCKED'
  | 'BLOCKED';

export type RuntimeHealthState =
  | 'HEALTHY'
  | 'DEGRADED'
  | 'DOWN';

export interface RuntimeEnforcementInput {
  readonly dataIntegrityValid: boolean;
  readonly runtimeSanityState: RuntimeSanityState;
  readonly sessionBreakerState: SessionBreakerState;
  readonly drawdownLockState: DrawdownLockState;
  readonly runtimeHealthState: RuntimeHealthState;
  readonly cooldownActive: boolean;
  readonly financialExposureAllowed: boolean;
  readonly candidateAvailable: boolean;
}

export interface RuntimeEnforcementDecision {
  readonly verdict: RuntimeEnforcementVerdict;
  readonly allowed: boolean;
  readonly reasons: readonly string[];
}

export interface RuntimeEnforcementFailure {
  readonly ok: false;
  readonly error: string;
}

export interface RuntimeEnforcementSuccess {
  readonly ok: true;
  readonly value: RuntimeEnforcementDecision;
}

export type RuntimeEnforcementResult =
  | RuntimeEnforcementSuccess
  | RuntimeEnforcementFailure;

/**
 * Consolidates independent runtime guards into a single deterministic
 * enforcement verdict. The engine is stateless and performs a fixed number
 * of checks, which keeps runtime cost O(1) for low-memory devices.
 */
export class RuntimeEnforcementOrchestrator {
  public evaluate(
    input: RuntimeEnforcementInput
  ): RuntimeEnforcementResult {
    if (!this.isValidInput(input)) {
      return {
        ok: false,
        error: 'INVALID_RUNTIME_ENFORCEMENT_INPUT'
      };
    }

    if (!input.dataIntegrityValid) {
      return this.decision('BLOCKED', ['DATA_INTEGRITY_INVALID']);
    }

    if (input.runtimeHealthState === 'DOWN') {
      return this.decision('FREEZE', ['RUNTIME_HEALTH_DOWN']);
    }

    if (input.runtimeSanityState === 'BLOCKED') {
      return this.decision('BLOCKED', ['RUNTIME_SANITY_BLOCKED']);
    }

    if (input.runtimeSanityState === 'PARADIGM_BREAK') {
      return this.decision('LOCKED', ['PARADIGM_BREAK_DETECTED']);
    }

    if (input.sessionBreakerState === 'BLOCKED') {
      return this.decision('BLOCKED', ['SESSION_BREAKER_BLOCKED']);
    }

    if (input.sessionBreakerState === 'SESSION_LOCKED') {
      return this.decision('LOCKED', ['SESSION_LOCKED']);
    }

    if (input.sessionBreakerState === 'SESSION_PROFIT_LOCKED') {
      return this.decision('LOCKED', ['SESSION_PROFIT_LOCKED']);
    }

    if (input.drawdownLockState === 'BLOCKED') {
      return this.decision('BLOCKED', ['DRAWDOWN_BLOCKED']);
    }

    if (input.drawdownLockState === 'DRAWDOWN_LOCKED') {
      return this.decision('LOCKED', ['DRAWDOWN_LOCKED']);
    }

    if (input.cooldownActive) {
      return this.decision('NO_GO', ['COOLDOWN_ACTIVE']);
    }

    if (
      input.runtimeSanityState === 'SANITY_REVIEW' ||
      input.sessionBreakerState === 'SESSION_REVIEW' ||
      input.drawdownLockState === 'DRAWDOWN_REVIEW' ||
      input.runtimeHealthState === 'DEGRADED'
    ) {
      return this.decision('REVIEW', ['RUNTIME_REVIEW_REQUIRED']);
    }

    if (!input.financialExposureAllowed) {
      return this.decision('NO_GO', ['FINANCIAL_EXPOSURE_NOT_ALLOWED']);
    }

    if (!input.candidateAvailable) {
      return this.decision('NO_GO', ['NO_CANDIDATE_AVAILABLE']);
    }

    return this.decision('ALLOW', ['ALL_GUARDS_ALLOW']);
  }

  private decision(
    verdict: RuntimeEnforcementVerdict,
    reasons: readonly string[]
  ): RuntimeEnforcementSuccess {
    return {
      ok: true,
      value: {
        verdict,
        allowed: verdict === 'ALLOW',
        reasons
      }
    };
  }

  private isValidInput(
    input: RuntimeEnforcementInput
  ): input is RuntimeEnforcementInput {
    return (
      typeof input === 'object' &&
      input !== null &&
      typeof input.dataIntegrityValid === 'boolean' &&
      typeof input.cooldownActive === 'boolean' &&
      typeof input.financialExposureAllowed === 'boolean' &&
      typeof input.candidateAvailable === 'boolean' &&
      this.isRuntimeSanityState(input.runtimeSanityState) &&
      this.isSessionBreakerState(input.sessionBreakerState) &&
      this.isDrawdownLockState(input.drawdownLockState) &&
      this.isRuntimeHealthState(input.runtimeHealthState)
    );
  }

  private isRuntimeSanityState(
    value: unknown
  ): value is RuntimeSanityState {
    return (
      value === 'SANITY_OK' ||
      value === 'SANITY_REVIEW' ||
      value === 'PARADIGM_BREAK' ||
      value === 'BLOCKED'
    );
  }

  private isSessionBreakerState(
    value: unknown
  ): value is SessionBreakerState {
    return (
      value === 'SESSION_OPEN' ||
      value === 'SESSION_REVIEW' ||
      value === 'SESSION_LOCKED' ||
      value === 'SESSION_PROFIT_LOCKED' ||
      value === 'BLOCKED'
    );
  }

  private isDrawdownLockState(
    value: unknown
  ): value is DrawdownLockState {
    return (
      value === 'DRAWDOWN_OK' ||
      value === 'DRAWDOWN_REVIEW' ||
      value === 'DRAWDOWN_LOCKED' ||
      value === 'BLOCKED'
    );
  }

  private isRuntimeHealthState(
    value: unknown
  ): value is RuntimeHealthState {
    return (
      value === 'HEALTHY' ||
      value === 'DEGRADED' ||
      value === 'DOWN'
    );
  }
}
