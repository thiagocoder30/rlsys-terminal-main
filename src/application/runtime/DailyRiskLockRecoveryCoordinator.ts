import {
  PersistentDailyBankrollRiskLock,
  type PersistentDailyBankrollRiskLockEvaluation,
  type PersistentDailyBankrollRiskLockSnapshot,
} from './PersistentDailyBankrollRiskLock.js';

export interface DailyRiskLockRepositoryPort {
  load(): Promise<
    | { readonly ok: true; readonly value: PersistentDailyBankrollRiskLockSnapshot | null }
    | {
        readonly ok: false;
        readonly error: {
          readonly code: string;
          readonly stage: string;
          readonly message: string;
        };
      }
  >;

  clear(): Promise<
    | { readonly ok: true; readonly value: true }
    | {
        readonly ok: false;
        readonly error: {
          readonly code: string;
          readonly stage: string;
          readonly message: string;
        };
      }
  >;
}

export type DailyRiskLockRecoveryStatus =
  | 'RECOVERY_NO_LOCK'
  | 'RECOVERY_LOCK_ACTIVE'
  | 'RECOVERY_LOCK_RELEASED'
  | 'RECOVERY_FAILED';

export interface DailyRiskLockRecoveryCoordinatorInput {
  readonly recoveredAtEpochMs: number;
  readonly clearReleasedLock: boolean;
}

export interface DailyRiskLockRecoveryCoordinatorReport {
  readonly status: DailyRiskLockRecoveryStatus;
  readonly isBlocked: boolean;
  readonly recoveredAtEpochMs: number;
  readonly lock: PersistentDailyBankrollRiskLockSnapshot | null;
  readonly evaluation: PersistentDailyBankrollRiskLockEvaluation | null;
  readonly clearedReleasedLock: boolean;
  readonly operatorSummary: string;
  readonly operatorDecisionRequired: true;
  readonly supervisedRecommendationOnly: true;
  readonly institutionalAnalysisMode: true;
}

export interface DailyRiskLockRecoveryCoordinatorFailure {
  readonly code: 'INVALID_DAILY_RISK_LOCK_RECOVERY_INPUT' | 'DAILY_RISK_LOCK_RECOVERY_FAILED';
  readonly stage: 'VALIDATION' | 'REPOSITORY' | 'EVALUATION';
  readonly message: string;
}

export type DailyRiskLockRecoveryCoordinatorResult =
  | { readonly ok: true; readonly value: DailyRiskLockRecoveryCoordinatorReport }
  | { readonly ok: false; readonly error: DailyRiskLockRecoveryCoordinatorFailure };

/**
 * Coordinates boot/restart recovery for the persistent daily bankroll risk lock.
 *
 * The coordinator loads the persisted lock, evaluates whether it is still active
 * and optionally clears it once the unlock time has passed.
 *
 * Complexity:
 * - Time: O(1)
 * - Space: O(1)
 */
export class DailyRiskLockRecoveryCoordinator {
  private readonly repository: DailyRiskLockRepositoryPort;
  private readonly lockEngine: PersistentDailyBankrollRiskLock;

  public constructor(
    repository: DailyRiskLockRepositoryPort,
    lockEngine: PersistentDailyBankrollRiskLock = new PersistentDailyBankrollRiskLock(),
  ) {
    this.repository = repository;
    this.lockEngine = lockEngine;
  }

  public async recover(
    input: DailyRiskLockRecoveryCoordinatorInput,
  ): Promise<DailyRiskLockRecoveryCoordinatorResult> {
    const validationFailure = this.validate(input);
    if (validationFailure !== null) {
      return { ok: false, error: validationFailure };
    }

    const loaded = await this.repository.load();
    if (!loaded.ok) {
      return {
        ok: false,
        error: this.failure('DAILY_RISK_LOCK_RECOVERY_FAILED', 'REPOSITORY', loaded.error.message),
      };
    }

    if (loaded.value === null) {
      return {
        ok: true,
        value: Object.freeze({
          status: 'RECOVERY_NO_LOCK',
          isBlocked: false,
          recoveredAtEpochMs: input.recoveredAtEpochMs,
          lock: null,
          evaluation: null,
          clearedReleasedLock: false,
          operatorSummary: 'Nenhum bloqueio diário de banca foi encontrado no recovery.',
          operatorDecisionRequired: true,
          supervisedRecommendationOnly: true,
          institutionalAnalysisMode: true,
        }),
      };
    }

    const evaluation = this.lockEngine.evaluate({
      evaluatedAtEpochMs: input.recoveredAtEpochMs,
      lock: loaded.value,
    });

    if (!evaluation.ok) {
      return {
        ok: false,
        error: this.failure('DAILY_RISK_LOCK_RECOVERY_FAILED', 'EVALUATION', evaluation.error.message),
      };
    }

    if (evaluation.value.isBlocked) {
      return {
        ok: true,
        value: Object.freeze({
          status: 'RECOVERY_LOCK_ACTIVE',
          isBlocked: true,
          recoveredAtEpochMs: input.recoveredAtEpochMs,
          lock: loaded.value,
          evaluation: evaluation.value,
          clearedReleasedLock: false,
          operatorSummary: this.activeSummary(loaded.value),
          operatorDecisionRequired: true,
          supervisedRecommendationOnly: true,
          institutionalAnalysisMode: true,
        }),
      };
    }

    let clearedReleasedLock = false;

    if (input.clearReleasedLock) {
      const cleared = await this.repository.clear();
      if (!cleared.ok) {
        return {
          ok: false,
          error: this.failure('DAILY_RISK_LOCK_RECOVERY_FAILED', 'REPOSITORY', cleared.error.message),
        };
      }

      clearedReleasedLock = true;
    }

    return {
      ok: true,
      value: Object.freeze({
        status: 'RECOVERY_LOCK_RELEASED',
        isBlocked: false,
        recoveredAtEpochMs: input.recoveredAtEpochMs,
        lock: evaluation.value.lock,
        evaluation: evaluation.value,
        clearedReleasedLock,
        operatorSummary: clearedReleasedLock
          ? 'Bloqueio diário expirado e removido do repositório.'
          : 'Bloqueio diário expirado. Nova avaliação institucional pode ser realizada.',
        operatorDecisionRequired: true,
        supervisedRecommendationOnly: true,
        institutionalAnalysisMode: true,
      }),
    };
  }

  private validate(
    input: DailyRiskLockRecoveryCoordinatorInput,
  ): DailyRiskLockRecoveryCoordinatorFailure | null {
    if (!Number.isFinite(input.recoveredAtEpochMs) || input.recoveredAtEpochMs <= 0) {
      return this.failure(
        'INVALID_DAILY_RISK_LOCK_RECOVERY_INPUT',
        'VALIDATION',
        'recoveredAtEpochMs must be a positive finite number',
      );
    }

    if (typeof input.clearReleasedLock !== 'boolean') {
      return this.failure(
        'INVALID_DAILY_RISK_LOCK_RECOVERY_INPUT',
        'VALIDATION',
        'clearReleasedLock must be boolean',
      );
    }

    return null;
  }

  private activeSummary(lock: PersistentDailyBankrollRiskLockSnapshot): string {
    if (lock.reason === 'STOP_WIN_REACHED') {
      return `Bloqueio diário ativo por Stop Win. Nova sessão PAPER bloqueada até ${lock.unlockAtEpochMs}.`;
    }

    if (lock.reason === 'STOP_LOSS_REACHED') {
      return `Bloqueio diário ativo por Stop Loss. Nova sessão PAPER bloqueada até ${lock.unlockAtEpochMs}.`;
    }

    return `Bloqueio diário de banca ativo. Nova sessão PAPER bloqueada até ${lock.unlockAtEpochMs}.`;
  }

  private failure(
    code: DailyRiskLockRecoveryCoordinatorFailure['code'],
    stage: DailyRiskLockRecoveryCoordinatorFailure['stage'],
    message: string,
  ): DailyRiskLockRecoveryCoordinatorFailure {
    return Object.freeze({ code, stage, message });
  }
}
