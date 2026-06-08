import type {
  FirstPaperSessionBankrollRiskIntegrationReport,
} from './FirstPaperSessionBankrollRiskIntegration.js';

export type PersistentDailyBankrollRiskLockReason =
  | 'STOP_WIN_REACHED'
  | 'STOP_LOSS_REACHED'
  | 'BANKROLL_BLOCKED';

export type PersistentDailyBankrollRiskLockStatus =
  | 'DAILY_RISK_LOCK_ACTIVE'
  | 'DAILY_RISK_LOCK_RELEASED'
  | 'DAILY_RISK_LOCK_NOT_REQUIRED';

export interface PersistentDailyBankrollRiskLockInput {
  readonly lockId: string;
  readonly generatedAtEpochMs: number;
  readonly operationalDay: string;
  readonly unlockAtEpochMs: number;
  readonly bankrollRisk: FirstPaperSessionBankrollRiskIntegrationReport;
}

export interface PersistentDailyBankrollRiskLockSnapshot {
  readonly lockId: string;
  readonly sessionId: string;
  readonly strategyName: string;
  readonly operationalDay: string;
  readonly reason: PersistentDailyBankrollRiskLockReason;
  readonly lockedAtEpochMs: number;
  readonly unlockAtEpochMs: number;
  readonly bankroll: number;
  readonly riskMode: string;
  readonly currentSessionPnl: number;
  readonly stopWinAmount: number;
  readonly stopLossAmount: number;
  readonly bankrollGateVerdict: string;
  readonly bankrollGateReason: string;
  readonly isActive: boolean;
  readonly operatorSummary: string;
  readonly operatorDecisionRequired: true;
  readonly supervisedRecommendationOnly: true;
  readonly institutionalAnalysisMode: true;
}

export interface PersistentDailyBankrollRiskLockEvaluationInput {
  readonly evaluatedAtEpochMs: number;
  readonly lock: PersistentDailyBankrollRiskLockSnapshot | null;
}

export interface PersistentDailyBankrollRiskLockEvaluation {
  readonly status: PersistentDailyBankrollRiskLockStatus;
  readonly isBlocked: boolean;
  readonly lock: PersistentDailyBankrollRiskLockSnapshot | null;
  readonly operatorSummary: string;
  readonly operatorDecisionRequired: true;
  readonly supervisedRecommendationOnly: true;
  readonly institutionalAnalysisMode: true;
}

export interface PersistentDailyBankrollRiskLockFailure {
  readonly code: 'INVALID_DAILY_BANKROLL_RISK_LOCK_INPUT';
  readonly stage: 'VALIDATION';
  readonly message: string;
}

export type PersistentDailyBankrollRiskLockResult =
  | { readonly ok: true; readonly value: PersistentDailyBankrollRiskLockSnapshot | null }
  | { readonly ok: false; readonly error: PersistentDailyBankrollRiskLockFailure };

export type PersistentDailyBankrollRiskLockEvaluationResult =
  | { readonly ok: true; readonly value: PersistentDailyBankrollRiskLockEvaluation }
  | { readonly ok: false; readonly error: PersistentDailyBankrollRiskLockFailure };

/**
 * Creates and evaluates a serializable daily bankroll risk lock.
 *
 * This engine does not recalculate stop-win/stop-loss. It consumes the existing
 * bankroll risk integration report and creates a persistent snapshot only when
 * the bankroll gate is blocked by stop-win, stop-loss or another bankroll block.
 *
 * Complexity:
 * - Time: O(1)
 * - Space: O(1)
 */
export class PersistentDailyBankrollRiskLock {
  public create(
    input: PersistentDailyBankrollRiskLockInput,
  ): PersistentDailyBankrollRiskLockResult {
    const validationFailure = this.validateCreate(input);
    if (validationFailure !== null) {
      return { ok: false, error: validationFailure };
    }

    if (input.bankrollRisk.bankrollStatus !== 'BANKROLL_BLOCKED') {
      return { ok: true, value: null };
    }

    const reason = this.reason(input.bankrollRisk.bankrollGate.reason);

    return {
      ok: true,
      value: Object.freeze({
        lockId: input.lockId.trim(),
        sessionId: input.bankrollRisk.sessionId,
        strategyName: input.bankrollRisk.strategyName,
        operationalDay: input.operationalDay,
        reason,
        lockedAtEpochMs: input.generatedAtEpochMs,
        unlockAtEpochMs: input.unlockAtEpochMs,
        bankroll: input.bankrollRisk.riskProfile.bankroll,
        riskMode: input.bankrollRisk.riskProfile.riskMode,
        currentSessionPnl: input.bankrollRisk.currentSessionPnl,
        stopWinAmount: input.bankrollRisk.stopWinAmount,
        stopLossAmount: input.bankrollRisk.stopLossAmount,
        bankrollGateVerdict: input.bankrollRisk.bankrollGate.verdict,
        bankrollGateReason: input.bankrollRisk.bankrollGate.reason,
        isActive: true,
        operatorSummary: this.summary(reason, input.unlockAtEpochMs),
        operatorDecisionRequired: true,
        supervisedRecommendationOnly: true,
        institutionalAnalysisMode: true,
      }),
    };
  }

  public evaluate(
    input: PersistentDailyBankrollRiskLockEvaluationInput,
  ): PersistentDailyBankrollRiskLockEvaluationResult {
    const validationFailure = this.validateEvaluation(input);
    if (validationFailure !== null) {
      return { ok: false, error: validationFailure };
    }

    if (input.lock === null) {
      return {
        ok: true,
        value: Object.freeze({
          status: 'DAILY_RISK_LOCK_NOT_REQUIRED',
          isBlocked: false,
          lock: null,
          operatorSummary: 'Nenhum bloqueio diário de banca está ativo.',
          operatorDecisionRequired: true,
          supervisedRecommendationOnly: true,
          institutionalAnalysisMode: true,
        }),
      };
    }

    const active = input.lock.isActive && input.evaluatedAtEpochMs < input.lock.unlockAtEpochMs;

    if (active) {
      return {
        ok: true,
        value: Object.freeze({
          status: 'DAILY_RISK_LOCK_ACTIVE',
          isBlocked: true,
          lock: input.lock,
          operatorSummary: `Bloqueio diário de banca ativo até ${input.lock.unlockAtEpochMs}. Não iniciar nova sessão PAPER.`,
          operatorDecisionRequired: true,
          supervisedRecommendationOnly: true,
          institutionalAnalysisMode: true,
        }),
      };
    }

    return {
      ok: true,
      value: Object.freeze({
        status: 'DAILY_RISK_LOCK_RELEASED',
        isBlocked: false,
        lock: Object.freeze({
          ...input.lock,
          isActive: false,
        }),
        operatorSummary: 'Bloqueio diário de banca liberado. Nova avaliação institucional pode ser realizada.',
        operatorDecisionRequired: true,
        supervisedRecommendationOnly: true,
        institutionalAnalysisMode: true,
      }),
    };
  }

  private validateCreate(
    input: PersistentDailyBankrollRiskLockInput,
  ): PersistentDailyBankrollRiskLockFailure | null {
    if (typeof input.lockId !== 'string' || input.lockId.trim().length === 0) {
      return this.failure('lockId is required');
    }

    if (!Number.isFinite(input.generatedAtEpochMs) || input.generatedAtEpochMs <= 0) {
      return this.failure('generatedAtEpochMs must be a positive finite number');
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.operationalDay)) {
      return this.failure('operationalDay must use YYYY-MM-DD');
    }

    if (!Number.isFinite(input.unlockAtEpochMs) || input.unlockAtEpochMs <= input.generatedAtEpochMs) {
      return this.failure('unlockAtEpochMs must be greater than generatedAtEpochMs');
    }

    if (!this.isValidBankrollRisk(input.bankrollRisk)) {
      return this.failure('bankrollRisk is invalid or violates supervised recommendation semantics');
    }

    return null;
  }

  private validateEvaluation(
    input: PersistentDailyBankrollRiskLockEvaluationInput,
  ): PersistentDailyBankrollRiskLockFailure | null {
    if (!Number.isFinite(input.evaluatedAtEpochMs) || input.evaluatedAtEpochMs <= 0) {
      return this.failure('evaluatedAtEpochMs must be a positive finite number');
    }

    if (input.lock !== null && !this.isValidLock(input.lock)) {
      return this.failure('lock is invalid or violates supervised recommendation semantics');
    }

    return null;
  }

  private isValidBankrollRisk(report: FirstPaperSessionBankrollRiskIntegrationReport): boolean {
    return (
      typeof report === 'object' &&
      report !== null &&
      typeof report.integrationId === 'string' &&
      report.integrationId.trim().length > 0 &&
      typeof report.sessionId === 'string' &&
      report.sessionId.trim().length > 0 &&
      typeof report.strategyName === 'string' &&
      report.strategyName.trim().length > 0 &&
      (
        report.bankrollStatus === 'BANKROLL_READY' ||
        report.bankrollStatus === 'BANKROLL_REVIEW_REQUIRED' ||
        report.bankrollStatus === 'BANKROLL_BLOCKED'
      ) &&
      typeof report.bankrollGate === 'object' &&
      report.bankrollGate !== null &&
      typeof report.bankrollGate.reason === 'string' &&
      typeof report.riskProfile === 'object' &&
      report.riskProfile !== null &&
      Number.isFinite(report.riskProfile.bankroll) &&
      Number.isFinite(report.currentSessionPnl) &&
      Number.isFinite(report.stopWinAmount) &&
      Number.isFinite(report.stopLossAmount) &&
      report.operatorDecisionRequired === true &&
      report.supervisedRecommendationOnly === true &&
      report.institutionalAnalysisMode === true
    );
  }

  private isValidLock(lock: PersistentDailyBankrollRiskLockSnapshot): boolean {
    return (
      typeof lock === 'object' &&
      lock !== null &&
      typeof lock.lockId === 'string' &&
      lock.lockId.trim().length > 0 &&
      typeof lock.sessionId === 'string' &&
      lock.sessionId.trim().length > 0 &&
      typeof lock.strategyName === 'string' &&
      lock.strategyName.trim().length > 0 &&
      /^\d{4}-\d{2}-\d{2}$/.test(lock.operationalDay) &&
      (
        lock.reason === 'STOP_WIN_REACHED' ||
        lock.reason === 'STOP_LOSS_REACHED' ||
        lock.reason === 'BANKROLL_BLOCKED'
      ) &&
      Number.isFinite(lock.lockedAtEpochMs) &&
      Number.isFinite(lock.unlockAtEpochMs) &&
      lock.unlockAtEpochMs > lock.lockedAtEpochMs &&
      typeof lock.isActive === 'boolean' &&
      lock.operatorDecisionRequired === true &&
      lock.supervisedRecommendationOnly === true &&
      lock.institutionalAnalysisMode === true
    );
  }

  private reason(gateReason: string): PersistentDailyBankrollRiskLockReason {
    const lower = gateReason.toLowerCase();

    if (lower.includes('stop win')) {
      return 'STOP_WIN_REACHED';
    }

    if (lower.includes('stop loss')) {
      return 'STOP_LOSS_REACHED';
    }

    return 'BANKROLL_BLOCKED';
  }

  private summary(reason: PersistentDailyBankrollRiskLockReason, unlockAtEpochMs: number): string {
    if (reason === 'STOP_WIN_REACHED') {
      return `Stop Win atingido. Bloqueio diário criado até ${unlockAtEpochMs} para preservar lucro.`;
    }

    if (reason === 'STOP_LOSS_REACHED') {
      return `Stop Loss atingido. Bloqueio diário criado até ${unlockAtEpochMs} para proteger a banca.`;
    }

    return `Controle de banca bloqueado. Bloqueio diário criado até ${unlockAtEpochMs}.`;
  }

  private failure(message: string): PersistentDailyBankrollRiskLockFailure {
    return Object.freeze({
      code: 'INVALID_DAILY_BANKROLL_RISK_LOCK_INPUT',
      stage: 'VALIDATION',
      message,
    });
  }
}
