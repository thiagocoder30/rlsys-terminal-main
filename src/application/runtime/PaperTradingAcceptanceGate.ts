import type {
  PaperEntryLedgerRepositoryPort,
} from '../ledger/PaperEntryLedgerRepositoryPort.js';
import {
  FirstCompletePaperSessionCertification,
  type FirstCompletePaperSessionCertificationInput,
  type FirstCompletePaperSessionCertificationStatus,
} from './FirstCompletePaperSessionCertification.js';

export type PaperTradingAcceptanceGateStatus =
  | 'PAPER_ACCEPTED'
  | 'PAPER_NEEDS_REVIEW'
  | 'PAPER_REJECTED';

export interface PaperTradingAcceptanceGateInput extends FirstCompletePaperSessionCertificationInput {
  readonly minimumCertificationScorePercent?: number;
  readonly requirePerfectCertification?: boolean;
}

export interface PaperTradingAcceptanceGateDecision {
  readonly status: PaperTradingAcceptanceGateStatus;
  readonly generatedAtEpochMs: number;
  readonly sessionId: string;
  readonly certificationStatus: FirstCompletePaperSessionCertificationStatus;
  readonly certificationScorePercent: number;
  readonly acceptedForRepeatPaperSessions: boolean;
  readonly rejectedForPaperSessions: boolean;
  readonly requiresHumanReview: boolean;
  readonly decisionSummary: string;
  readonly recommendation: string;
  readonly paperOnly: true;
  readonly liveMoneyAuthorization: false;
  readonly automaticExecutionAllowed: false;
  readonly automaticBetExecutionAllowed: false;
  readonly humanSupervisionRequired: true;
}

export interface PaperTradingAcceptanceGateTextReport {
  readonly status: PaperTradingAcceptanceGateStatus;
  readonly generatedAtEpochMs: number;
  readonly text: string;
  readonly paperOnly: true;
  readonly liveMoneyAuthorization: false;
  readonly automaticExecutionAllowed: false;
  readonly automaticBetExecutionAllowed: false;
  readonly humanSupervisionRequired: true;
}

export interface PaperTradingAcceptanceGateSuccess<T> {
  readonly ok: true;
  readonly value: T;
}

export interface PaperTradingAcceptanceGateFailure {
  readonly ok: false;
  readonly error: {
    readonly code: 'PAPER_TRADING_ACCEPTANCE_GATE_ERROR';
    readonly message: string;
  };
}

export type PaperTradingAcceptanceGateResult<T> =
  | PaperTradingAcceptanceGateSuccess<T>
  | PaperTradingAcceptanceGateFailure;

/**
 * Acceptance gate for repeating supervised PAPER sessions.
 *
 * This gate accepts or rejects the PAPER operating template based on institutional
 * certification. It does not approve live money, profit claims, automatic
 * execution, or casino/platform automation.
 */
export class PaperTradingAcceptanceGate {
  private readonly certification: FirstCompletePaperSessionCertification;

  public constructor(repository: PaperEntryLedgerRepositoryPort) {
    this.certification = new FirstCompletePaperSessionCertification(repository);
  }

  public async evaluate(
    input: PaperTradingAcceptanceGateInput,
    generatedAtEpochMs = Date.now(),
  ): Promise<PaperTradingAcceptanceGateResult<PaperTradingAcceptanceGateDecision>> {
    const sessionId = typeof input.sessionId === 'string' ? input.sessionId.trim() : '';

    if (sessionId.length === 0) {
      return this.failure('sessionId is required');
    }

    const certified = await this.certification.certify(input, generatedAtEpochMs);

    if (!certified.ok) {
      return this.failure(certified.error.message);
    }

    const minimumScore = Number.isFinite(input.minimumCertificationScorePercent)
      ? Math.max(0, Math.min(100, Number(input.minimumCertificationScorePercent)))
      : 100;
    const requirePerfectCertification = input.requirePerfectCertification !== false;

    const status = this.resolveStatus({
      certificationStatus: certified.value.status,
      certificationScorePercent: certified.value.certificationScorePercent,
      minimumScore,
      requirePerfectCertification,
    });

    return {
      ok: true,
      value: Object.freeze({
        status,
        generatedAtEpochMs,
        sessionId,
        certificationStatus: certified.value.status,
        certificationScorePercent: certified.value.certificationScorePercent,
        acceptedForRepeatPaperSessions: status === 'PAPER_ACCEPTED',
        rejectedForPaperSessions: status === 'PAPER_REJECTED',
        requiresHumanReview: status === 'PAPER_NEEDS_REVIEW',
        decisionSummary: this.decisionSummary({
          status,
          certificationStatus: certified.value.status,
          certificationScorePercent: certified.value.certificationScorePercent,
          minimumScore,
        }),
        recommendation: this.recommendationFor(status),
        paperOnly: true as const,
        liveMoneyAuthorization: false as const,
        automaticExecutionAllowed: false as const,
        automaticBetExecutionAllowed: false as const,
        humanSupervisionRequired: true as const,
      }),
    };
  }

  public async textReport(
    input: PaperTradingAcceptanceGateInput,
    generatedAtEpochMs = Date.now(),
  ): Promise<PaperTradingAcceptanceGateResult<PaperTradingAcceptanceGateTextReport>> {
    const decision = await this.evaluate(input, generatedAtEpochMs);

    if (!decision.ok) {
      return decision;
    }

    const lines = [
      'RL.SYS CORE — PAPER TRADING ACCEPTANCE GATE',
      '============================================',
      `Generated At EpochMs: ${decision.value.generatedAtEpochMs}`,
      `SessionId: ${decision.value.sessionId}`,
      `Status: ${decision.value.status}`,
      `CertificationStatus: ${decision.value.certificationStatus}`,
      `CertificationScorePercent: ${decision.value.certificationScorePercent}`,
      `AcceptedForRepeatPaperSessions: ${decision.value.acceptedForRepeatPaperSessions}`,
      `RejectedForPaperSessions: ${decision.value.rejectedForPaperSessions}`,
      `RequiresHumanReview: ${decision.value.requiresHumanReview}`,
      '',
      'Decision Summary:',
      decision.value.decisionSummary,
      '',
      'Recommendation:',
      decision.value.recommendation,
      '',
      'Governance:',
      'PaperOnly: true',
      'LiveMoneyAuthorization: false',
      'AutomaticExecutionAllowed: false',
      'AutomaticBetExecutionAllowed: false',
      'HumanSupervisionRequired: true',
      'CertifiesLiveMoney: false',
      'CertifiesProfit: false',
    ];

    return {
      ok: true,
      value: Object.freeze({
        status: decision.value.status,
        generatedAtEpochMs,
        text: `${lines.join('\n')}\n`,
        paperOnly: true as const,
        liveMoneyAuthorization: false as const,
        automaticExecutionAllowed: false as const,
        automaticBetExecutionAllowed: false as const,
        humanSupervisionRequired: true as const,
      }),
    };
  }

  private resolveStatus(input: {
    readonly certificationStatus: FirstCompletePaperSessionCertificationStatus;
    readonly certificationScorePercent: number;
    readonly minimumScore: number;
    readonly requirePerfectCertification: boolean;
  }): PaperTradingAcceptanceGateStatus {
    if (input.certificationStatus === 'PAPER_SESSION_CERTIFICATION_REJECTED') {
      return 'PAPER_REJECTED';
    }

    if (
      input.certificationStatus === 'PAPER_SESSION_CERTIFIED' &&
      input.certificationScorePercent >= input.minimumScore &&
      (!input.requirePerfectCertification || input.certificationScorePercent === 100)
    ) {
      return 'PAPER_ACCEPTED';
    }

    return 'PAPER_NEEDS_REVIEW';
  }

  private decisionSummary(input: {
    readonly status: PaperTradingAcceptanceGateStatus;
    readonly certificationStatus: FirstCompletePaperSessionCertificationStatus;
    readonly certificationScorePercent: number;
    readonly minimumScore: number;
  }): string {
    return [
      `AcceptanceStatus=${input.status}`,
      `CertificationStatus=${input.certificationStatus}`,
      `CertificationScorePercent=${input.certificationScorePercent}`,
      `MinimumRequiredScore=${input.minimumScore}`,
      'AcceptedScope=Repeat supervised PAPER sessions only',
      'LiveMoneyAuthorization=false',
      'AutomaticExecutionAllowed=false',
      'AutomaticBetExecutionAllowed=false',
      'CertifiesProfit=false',
    ].join('; ');
  }

  private recommendationFor(status: PaperTradingAcceptanceGateStatus): string {
    if (status === 'PAPER_ACCEPTED') {
      return 'RL.SYS CORE may repeat supervised PAPER sessions under the same institutional protocol. Live money remains blocked.';
    }

    if (status === 'PAPER_NEEDS_REVIEW') {
      return 'Human review is required before repeating supervised PAPER sessions. Live money remains blocked.';
    }

    return 'Repeat PAPER sessions are rejected until certification failures are resolved. Live money remains blocked.';
  }

  private failure(message: string): PaperTradingAcceptanceGateFailure {
    return {
      ok: false,
      error: {
        code: 'PAPER_TRADING_ACCEPTANCE_GATE_ERROR',
        message,
      },
    };
  }
}
