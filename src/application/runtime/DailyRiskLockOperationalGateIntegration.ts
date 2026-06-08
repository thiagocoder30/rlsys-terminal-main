import type {
  DailyRiskLockRecoveryCoordinatorReport,
} from './DailyRiskLockRecoveryCoordinator.js';

export type DailyRiskLockOperationalIntent =
  | 'PREPARE'
  | 'START'
  | 'RESUME'
  | 'STATUS'
  | 'REPORT'
  | 'FINISH'
  | 'RESET';

export type DailyRiskLockOperationalGateStatus =
  | 'OPERATION_ALLOWED'
  | 'OPERATION_BLOCKED_BY_DAILY_RISK_LOCK';

export interface DailyRiskLockOperationalGateInput {
  readonly intent: DailyRiskLockOperationalIntent;
  readonly recovery: DailyRiskLockRecoveryCoordinatorReport;
}

export interface DailyRiskLockOperationalGateReport {
  readonly status: DailyRiskLockOperationalGateStatus;
  readonly allowed: boolean;
  readonly intent: DailyRiskLockOperationalIntent;
  readonly recoveryStatus: DailyRiskLockRecoveryCoordinatorReport['status'];
  readonly isDailyRiskLocked: boolean;
  readonly lockId: string | null;
  readonly lockReason: string | null;
  readonly unlockAtEpochMs: number | null;
  readonly operatorSummary: string;
  readonly reasons: readonly string[];
  readonly operatorDecisionRequired: true;
  readonly supervisedRecommendationOnly: true;
  readonly institutionalAnalysisMode: true;
}

export interface DailyRiskLockOperationalGateFailure {
  readonly code: 'INVALID_DAILY_RISK_LOCK_OPERATIONAL_GATE_INPUT';
  readonly stage: 'VALIDATION';
  readonly message: string;
}

export type DailyRiskLockOperationalGateResult =
  | { readonly ok: true; readonly value: DailyRiskLockOperationalGateReport }
  | { readonly ok: false; readonly error: DailyRiskLockOperationalGateFailure };

/**
 * Integrates Daily Risk Lock recovery into the operational gate layer.
 *
 * This adapter does not read files and does not recalculate bankroll risk.
 * It consumes the recovery report and decides whether a runtime intent may
 * continue. Mutating session intents are blocked while the daily lock is active.
 *
 * Complexity:
 * - Time: O(1)
 * - Space: O(1)
 */
export class DailyRiskLockOperationalGateIntegration {
  private readonly mutatingIntents: ReadonlySet<DailyRiskLockOperationalIntent> = new Set([
    'PREPARE',
    'START',
    'RESUME',
  ]);

  public evaluate(input: DailyRiskLockOperationalGateInput): DailyRiskLockOperationalGateResult {
    const validationFailure = this.validate(input);
    if (validationFailure !== null) {
      return { ok: false, error: validationFailure };
    }

    const shouldBlock = input.recovery.isBlocked && this.mutatingIntents.has(input.intent);

    if (shouldBlock) {
      return {
        ok: true,
        value: Object.freeze({
          status: 'OPERATION_BLOCKED_BY_DAILY_RISK_LOCK',
          allowed: false,
          intent: input.intent,
          recoveryStatus: input.recovery.status,
          isDailyRiskLocked: true,
          lockId: input.recovery.lock?.lockId ?? null,
          lockReason: input.recovery.lock?.reason ?? null,
          unlockAtEpochMs: input.recovery.lock?.unlockAtEpochMs ?? null,
          operatorSummary: this.blockSummary(input),
          reasons: Object.freeze(this.blockReasons(input)),
          operatorDecisionRequired: true,
          supervisedRecommendationOnly: true,
          institutionalAnalysisMode: true,
        }),
      };
    }

    return {
      ok: true,
      value: Object.freeze({
        status: 'OPERATION_ALLOWED',
        allowed: true,
        intent: input.intent,
        recoveryStatus: input.recovery.status,
        isDailyRiskLocked: input.recovery.isBlocked,
        lockId: input.recovery.lock?.lockId ?? null,
        lockReason: input.recovery.lock?.reason ?? null,
        unlockAtEpochMs: input.recovery.lock?.unlockAtEpochMs ?? null,
        operatorSummary: this.allowSummary(input),
        reasons: Object.freeze([]),
        operatorDecisionRequired: true,
        supervisedRecommendationOnly: true,
        institutionalAnalysisMode: true,
      }),
    };
  }

  private validate(input: DailyRiskLockOperationalGateInput): DailyRiskLockOperationalGateFailure | null {
    if (!this.isIntent(input.intent)) {
      return this.failure('intent must be a supported operational intent');
    }

    if (!this.isValidRecovery(input.recovery)) {
      return this.failure('recovery is invalid or violates supervised recommendation semantics');
    }

    return null;
  }

  private isIntent(intent: string): intent is DailyRiskLockOperationalIntent {
    return (
      intent === 'PREPARE' ||
      intent === 'START' ||
      intent === 'RESUME' ||
      intent === 'STATUS' ||
      intent === 'REPORT' ||
      intent === 'FINISH' ||
      intent === 'RESET'
    );
  }

  private isValidRecovery(recovery: DailyRiskLockRecoveryCoordinatorReport): boolean {
    return (
      typeof recovery === 'object' &&
      recovery !== null &&
      (
        recovery.status === 'RECOVERY_NO_LOCK' ||
        recovery.status === 'RECOVERY_LOCK_ACTIVE' ||
        recovery.status === 'RECOVERY_LOCK_RELEASED' ||
        recovery.status === 'RECOVERY_FAILED'
      ) &&
      typeof recovery.isBlocked === 'boolean' &&
      Number.isFinite(recovery.recoveredAtEpochMs) &&
      typeof recovery.operatorSummary === 'string' &&
      recovery.operatorDecisionRequired === true &&
      recovery.supervisedRecommendationOnly === true &&
      recovery.institutionalAnalysisMode === true
    );
  }

  private blockSummary(input: DailyRiskLockOperationalGateInput): string {
    const reason = input.recovery.lock?.reason ?? 'BANKROLL_BLOCKED';
    const unlockAt = input.recovery.lock?.unlockAtEpochMs ?? null;

    if (reason === 'STOP_WIN_REACHED') {
      return `Operação bloqueada: Stop Win diário atingido. Preservar lucro é obrigatório. Nova sessão PAPER somente após ${unlockAt}.`;
    }

    if (reason === 'STOP_LOSS_REACHED') {
      return `Operação bloqueada: Stop Loss diário atingido. Proteger a banca é obrigatório. Nova sessão PAPER somente após ${unlockAt}.`;
    }

    return `Operação bloqueada por trava diária de banca. Nova sessão PAPER somente após ${unlockAt}.`;
  }

  private allowSummary(input: DailyRiskLockOperationalGateInput): string {
    if (input.recovery.status === 'RECOVERY_LOCK_RELEASED') {
      return 'Trava diária de banca liberada. A operação pode seguir para nova avaliação institucional.';
    }

    if (input.recovery.status === 'RECOVERY_NO_LOCK') {
      return 'Nenhuma trava diária de banca ativa. A operação pode seguir para avaliação institucional.';
    }

    if (input.recovery.isBlocked) {
      return 'Trava diária ativa, mas o comando solicitado é apenas informativo e pode ser exibido ao operador.';
    }

    return 'Operação permitida pela integração da trava diária de banca.';
  }

  private blockReasons(input: DailyRiskLockOperationalGateInput): readonly string[] {
    const reasons = [
      'DAILY_RISK_LOCK_ACTIVE',
      `INTENT_BLOCKED:${input.intent}`,
    ];

    if (input.recovery.lock?.reason) {
      reasons.push(`LOCK_REASON:${input.recovery.lock.reason}`);
    }

    if (typeof input.recovery.lock?.unlockAtEpochMs === 'number') {
      reasons.push(`UNLOCK_AT:${input.recovery.lock.unlockAtEpochMs}`);
    }

    return reasons;
  }

  private failure(message: string): DailyRiskLockOperationalGateFailure {
    return Object.freeze({
      code: 'INVALID_DAILY_RISK_LOCK_OPERATIONAL_GATE_INPUT',
      stage: 'VALIDATION',
      message,
    });
  }
}
