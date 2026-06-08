import type {
  FirstPaperSessionFinalReadinessVerdictReport,
} from './FirstPaperSessionFinalReadinessVerdict.js';

import {
  OperatorRiskProfileCalculator,
  type OperatorRiskMode,
  type OperatorRiskProfile,
} from '../../domain/risk/OperatorRiskProfile.js';

import {
  BankrollSafetyGate,
  type BankrollSafetyGateResult,
} from '../../domain/risk/BankrollSafetyGate.js';

export type FirstPaperSessionBankrollRiskStatus =
  | 'BANKROLL_READY'
  | 'BANKROLL_REVIEW_REQUIRED'
  | 'BANKROLL_BLOCKED';

export interface FirstPaperSessionBankrollRiskIntegrationInput {
  readonly integrationId: string;
  readonly generatedAtEpochMs: number;
  readonly finalVerdict: FirstPaperSessionFinalReadinessVerdictReport;
  readonly bankroll: number;
  readonly riskMode: OperatorRiskMode;
  readonly allowMartingale: boolean;
  readonly currentBalance: number;
  readonly requestedStake?: number;
  readonly currentSessionPnl: number;
  readonly martingaleStep: number;
}

export interface FirstPaperSessionBankrollRiskIntegrationReport {
  readonly integrationId: string;
  readonly generatedAtEpochMs: number;
  readonly sessionId: string;
  readonly strategyName: string;
  readonly readinessVerdict: FirstPaperSessionFinalReadinessVerdictReport['finalVerdict'];
  readonly bankrollStatus: FirstPaperSessionBankrollRiskStatus;
  readonly canStartPaperSession: boolean;
  readonly riskProfile: OperatorRiskProfile;
  readonly bankrollGate: BankrollSafetyGateResult;
  readonly currentBalance: number;
  readonly currentSessionPnl: number;
  readonly requestedStake: number;
  readonly stopWinAmount: number;
  readonly stopLossAmount: number;
  readonly remainingLossBudget: number;
  readonly remainingProfitTarget: number;
  readonly operatorSummary: string;
  readonly localizedOperatorSummary: string;
  readonly blockers: readonly string[];
  readonly warnings: readonly string[];
  readonly evidence: readonly string[];
  readonly operatorDecisionRequired: true;
  readonly supervisedRecommendationOnly: true;
  readonly institutionalAnalysisMode: true;
}

export interface FirstPaperSessionBankrollRiskIntegrationFailure {
  readonly code: 'INVALID_FIRST_PAPER_SESSION_BANKROLL_RISK_INPUT' | 'BANKROLL_RISK_CALCULATION_FAILED';
  readonly stage: 'VALIDATION' | 'CALCULATION';
  readonly message: string;
}

export type FirstPaperSessionBankrollRiskIntegrationResult =
  | { readonly ok: true; readonly value: FirstPaperSessionBankrollRiskIntegrationReport }
  | { readonly ok: false; readonly error: FirstPaperSessionBankrollRiskIntegrationFailure };

/**
 * Integrates the first PAPER session final readiness verdict with existing bankroll risk engines.
 *
 * This class does not create new stop-win/stop-loss rules. It reuses:
 * - OperatorRiskProfileCalculator
 * - BankrollSafetyGate
 *
 * Complexity:
 * - Time: O(n), where n is blockers + warnings length.
 * - Space: O(n), because operator-facing evidence is materialized.
 */
export class FirstPaperSessionBankrollRiskIntegration {
  private readonly profileCalculator: OperatorRiskProfileCalculator;
  private readonly bankrollGate: BankrollSafetyGate;

  public constructor(
    profileCalculator: OperatorRiskProfileCalculator = new OperatorRiskProfileCalculator(),
    bankrollGate: BankrollSafetyGate = new BankrollSafetyGate(),
  ) {
    this.profileCalculator = profileCalculator;
    this.bankrollGate = bankrollGate;
  }

  public evaluate(
    input: FirstPaperSessionBankrollRiskIntegrationInput,
  ): FirstPaperSessionBankrollRiskIntegrationResult {
    const validationFailure = this.validate(input);
    if (validationFailure !== null) {
      return { ok: false, error: validationFailure };
    }

    try {
      const riskProfile = this.profileCalculator.calculate({
        bankroll: input.bankroll,
        riskMode: input.riskMode,
        allowMartingale: input.allowMartingale,
      });

      const requestedStake = this.roundMoney(input.requestedStake ?? riskProfile.baseStake);

      const gate = this.bankrollGate.evaluate({
        profile: riskProfile,
        currentBalance: input.currentBalance,
        requestedStake,
        currentSessionPnl: input.currentSessionPnl,
        martingaleStep: input.martingaleStep,
      });

      const bankrollStatus = this.status(gate.verdict);
      const readinessAllowsStart = input.finalVerdict.canStartPaperSession;
      const canStartPaperSession = readinessAllowsStart && gate.verdict !== 'BLOCKED';

      const blockers = this.blockers(input.finalVerdict.blockers, gate);
      const warnings = this.warnings(input.finalVerdict.warnings, gate);

      return {
        ok: true,
        value: Object.freeze({
          integrationId: input.integrationId.trim(),
          generatedAtEpochMs: input.generatedAtEpochMs,
          sessionId: input.finalVerdict.sessionId,
          strategyName: input.finalVerdict.strategyName,
          readinessVerdict: input.finalVerdict.finalVerdict,
          bankrollStatus,
          canStartPaperSession,
          riskProfile,
          bankrollGate: gate,
          currentBalance: this.roundMoney(input.currentBalance),
          currentSessionPnl: this.roundMoney(input.currentSessionPnl),
          requestedStake,
          stopWinAmount: riskProfile.dailyStopWin,
          stopLossAmount: riskProfile.dailyStopLoss,
          remainingLossBudget: gate.remainingLossBudget,
          remainingProfitTarget: gate.remainingProfitTarget,
          operatorSummary: this.summary(input.finalVerdict.strategyName, canStartPaperSession, bankrollStatus, gate.reason),
          localizedOperatorSummary: this.localizedSummary(input.finalVerdict.strategyName, canStartPaperSession, bankrollStatus, gate),
          blockers: Object.freeze(blockers),
          warnings: Object.freeze(warnings),
          evidence: Object.freeze(this.evidence(input, riskProfile, gate)),
          operatorDecisionRequired: true,
          supervisedRecommendationOnly: true,
          institutionalAnalysisMode: true,
        }),
      };
    } catch (error: unknown) {
      return {
        ok: false,
        error: this.failure(
          'BANKROLL_RISK_CALCULATION_FAILED',
          'CALCULATION',
          error instanceof Error ? error.message : 'unknown bankroll risk calculation failure',
        ),
      };
    }
  }

  private validate(
    input: FirstPaperSessionBankrollRiskIntegrationInput,
  ): FirstPaperSessionBankrollRiskIntegrationFailure | null {
    if (typeof input.integrationId !== 'string' || input.integrationId.trim().length === 0) {
      return this.failure('INVALID_FIRST_PAPER_SESSION_BANKROLL_RISK_INPUT', 'VALIDATION', 'integrationId is required');
    }

    if (!Number.isFinite(input.generatedAtEpochMs) || input.generatedAtEpochMs <= 0) {
      return this.failure('INVALID_FIRST_PAPER_SESSION_BANKROLL_RISK_INPUT', 'VALIDATION', 'generatedAtEpochMs must be a positive finite number');
    }

    if (!this.isValidVerdict(input.finalVerdict)) {
      return this.failure('INVALID_FIRST_PAPER_SESSION_BANKROLL_RISK_INPUT', 'VALIDATION', 'finalVerdict is invalid or violates supervised recommendation semantics');
    }

    if (!Number.isFinite(input.bankroll) || input.bankroll <= 0) {
      return this.failure('INVALID_FIRST_PAPER_SESSION_BANKROLL_RISK_INPUT', 'VALIDATION', 'bankroll must be a positive finite number');
    }

    if (input.riskMode !== 'CONSERVATIVE' && input.riskMode !== 'MODERATE' && input.riskMode !== 'AGGRESSIVE') {
      return this.failure('INVALID_FIRST_PAPER_SESSION_BANKROLL_RISK_INPUT', 'VALIDATION', 'riskMode must be CONSERVATIVE, MODERATE or AGGRESSIVE');
    }

    if (typeof input.allowMartingale !== 'boolean') {
      return this.failure('INVALID_FIRST_PAPER_SESSION_BANKROLL_RISK_INPUT', 'VALIDATION', 'allowMartingale must be boolean');
    }

    if (!Number.isFinite(input.currentBalance) || input.currentBalance < 0) {
      return this.failure('INVALID_FIRST_PAPER_SESSION_BANKROLL_RISK_INPUT', 'VALIDATION', 'currentBalance must be a non-negative finite number');
    }

    if (typeof input.requestedStake !== 'undefined' && (!Number.isFinite(input.requestedStake) || input.requestedStake <= 0)) {
      return this.failure('INVALID_FIRST_PAPER_SESSION_BANKROLL_RISK_INPUT', 'VALIDATION', 'requestedStake must be positive when provided');
    }

    if (!Number.isFinite(input.currentSessionPnl)) {
      return this.failure('INVALID_FIRST_PAPER_SESSION_BANKROLL_RISK_INPUT', 'VALIDATION', 'currentSessionPnl must be finite');
    }

    if (!Number.isInteger(input.martingaleStep) || input.martingaleStep < 0) {
      return this.failure('INVALID_FIRST_PAPER_SESSION_BANKROLL_RISK_INPUT', 'VALIDATION', 'martingaleStep must be a non-negative integer');
    }

    return null;
  }

  private isValidVerdict(verdict: FirstPaperSessionFinalReadinessVerdictReport): boolean {
    return (
      typeof verdict === 'object' &&
      verdict !== null &&
      typeof verdict.verdictId === 'string' &&
      verdict.verdictId.trim().length > 0 &&
      typeof verdict.sessionId === 'string' &&
      verdict.sessionId.trim().length > 0 &&
      typeof verdict.strategyName === 'string' &&
      verdict.strategyName.trim().length > 0 &&
      (
        verdict.finalVerdict === 'READY_FOR_FIRST_PAPER_SESSION' ||
        verdict.finalVerdict === 'WARMUP_REQUIRED' ||
        verdict.finalVerdict === 'BLOCKED' ||
        verdict.finalVerdict === 'SESSION_LIMIT_REACHED'
      ) &&
      typeof verdict.canStartPaperSession === 'boolean' &&
      Array.isArray(verdict.blockers) &&
      Array.isArray(verdict.warnings) &&
      verdict.operatorDecisionRequired === true &&
      verdict.supervisedRecommendationOnly === true &&
      verdict.institutionalAnalysisMode === true
    );
  }

  private status(verdict: BankrollSafetyGateResult['verdict']): FirstPaperSessionBankrollRiskStatus {
    if (verdict === 'SAFE') {
      return 'BANKROLL_READY';
    }

    if (verdict === 'REVIEW') {
      return 'BANKROLL_REVIEW_REQUIRED';
    }

    return 'BANKROLL_BLOCKED';
  }

  private blockers(existing: readonly string[], gate: BankrollSafetyGateResult): readonly string[] {
    const blockers: string[] = [...existing];

    if (gate.verdict === 'BLOCKED') {
      blockers.push(`BANKROLL_BLOCKED:${gate.reason}`);
    }

    return this.unique(blockers);
  }

  private warnings(existing: readonly string[], gate: BankrollSafetyGateResult): readonly string[] {
    const warnings: string[] = [...existing];

    if (gate.verdict === 'REVIEW') {
      warnings.push(`BANKROLL_REVIEW:${gate.reason}`);
    }

    return this.unique(warnings);
  }

  private summary(
    strategyName: string,
    canStartPaperSession: boolean,
    bankrollStatus: FirstPaperSessionBankrollRiskStatus,
    gateReason: string,
  ): string {
    if (canStartPaperSession && bankrollStatus === 'BANKROLL_READY') {
      return `${strategyName}: readiness institucional e risco de banca aprovados para sessão PAPER supervisionada.`;
    }

    if (bankrollStatus === 'BANKROLL_REVIEW_REQUIRED') {
      return `${strategyName}: readiness aprovado, mas a banca exige revisão antes de qualquer decisão PAPER.`;
    }

    if (bankrollStatus === 'BANKROLL_BLOCKED') {
      return `${strategyName}: sessão bloqueada pelo controle de banca. ${gateReason}`;
    }

    return `${strategyName}: sessão ainda não pode iniciar porque o readiness institucional não aprovou o início.`;
  }

  private localizedSummary(
    strategyName: string,
    canStartPaperSession: boolean,
    bankrollStatus: FirstPaperSessionBankrollRiskStatus,
    gate: BankrollSafetyGateResult,
  ): string {
    if (canStartPaperSession && bankrollStatus === 'BANKROLL_READY') {
      return `${strategyName}: banca protegida, limites definidos e sessão PAPER liberada para início supervisionado.`;
    }

    if (bankrollStatus === 'BANKROLL_REVIEW_REQUIRED') {
      return `${strategyName}: atenção. A entrada solicitada exige revisão porque está acima da base recomendada.`;
    }

    if (bankrollStatus === 'BANKROLL_BLOCKED') {
      return `${strategyName}: não iniciar ou continuar. ${gate.reason}`;
    }

    return `${strategyName}: aguarde. A sessão ainda não recebeu veredito institucional favorável.`;
  }

  private evidence(
    input: FirstPaperSessionBankrollRiskIntegrationInput,
    profile: OperatorRiskProfile,
    gate: BankrollSafetyGateResult,
  ): readonly string[] {
    return [
      `READINESS_VERDICT:${input.finalVerdict.finalVerdict}`,
      `RISK_MODE:${profile.riskMode}`,
      `BANKROLL:${profile.bankroll.toFixed(2)}`,
      `BASE_STAKE:${profile.baseStake.toFixed(2)}`,
      `STOP_WIN:${profile.dailyStopWin.toFixed(2)}`,
      `STOP_LOSS:${profile.dailyStopLoss.toFixed(2)}`,
      `MAX_SINGLE_EXPOSURE:${profile.maxSingleExposure.toFixed(2)}`,
      `CURRENT_SESSION_PNL:${this.roundMoney(input.currentSessionPnl).toFixed(2)}`,
      `BANKROLL_GATE:${gate.verdict}`,
    ];
  }

  private unique(items: readonly string[]): readonly string[] {
    const seen = new Set<string>();
    const output: string[] = [];

    for (const item of items) {
      const normalized = item.trim();
      if (normalized.length > 0 && !seen.has(normalized)) {
        seen.add(normalized);
        output.push(normalized);
      }
    }

    return output;
  }

  private roundMoney(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private failure(
    code: FirstPaperSessionBankrollRiskIntegrationFailure['code'],
    stage: FirstPaperSessionBankrollRiskIntegrationFailure['stage'],
    message: string,
  ): FirstPaperSessionBankrollRiskIntegrationFailure {
    return Object.freeze({ code, stage, message });
  }
}
