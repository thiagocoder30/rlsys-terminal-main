import { createHash } from 'node:crypto';

import type {
  PaperEntryLedgerRepositoryPort,
} from '../ledger/PaperEntryLedgerRepositoryPort.js';
import {
  FirstPaperSessionFinalPreflightOrchestrator,
  type FirstPaperSessionFinalPreflightVerdict,
} from './FirstPaperSessionFinalPreflightOrchestrator.js';
import {
  FirstPaperSessionManualExecutionProtocol,
  type FirstPaperSessionManualExecutionProtocolStatus,
} from './FirstPaperSessionManualExecutionProtocol.js';
import {
  FirstPaperSessionClosingProtocol,
  type FirstPaperSessionClosingStatus,
} from './FirstPaperSessionClosingProtocol.js';

export type FirstCompletePaperSessionCertificationStatus =
  | 'PAPER_SESSION_CERTIFIED'
  | 'PAPER_SESSION_CERTIFIED_WITH_REVIEW'
  | 'PAPER_SESSION_CERTIFICATION_REJECTED';

export interface FirstCompletePaperSessionCertificationInput {
  readonly sessionId: string;
  readonly operatorConfirmedLaunch: boolean;
  readonly operatorConfirmedClose: boolean;
  readonly runtimePaperAvailable?: boolean;
  readonly snapshotPathAvailable?: boolean;
  readonly ledgerPathConfigured?: boolean;
  readonly minimumRecommendedLedgerEntries?: number;
  readonly maxDeniedByHudRatio?: number;
  readonly maxRejectedByOperatorRatio?: number;
  readonly operatorId?: string;
  readonly tableId?: string;
  readonly strategyName?: string;
  readonly bankrollLabel?: string;
  readonly plannedRounds?: number;
  readonly notes?: readonly string[];
  readonly allowNeedsReviewRecording?: boolean;
  readonly snapshotValidated?: boolean;
  readonly ledgerValidated?: boolean;
  readonly reportExported?: boolean;
  readonly auditExported?: boolean;
  readonly totalWins?: number;
  readonly totalLosses?: number;
  readonly totalSkips?: number;
  readonly closingNotes?: readonly string[];
  readonly allowCloseWithReview?: boolean;
}

export interface FirstCompletePaperSessionCertificationCheck {
  readonly name: string;
  readonly passed: boolean;
  readonly message: string;
}

export interface FirstCompletePaperSessionCertificationReport {
  readonly certificationId: string;
  readonly sessionId: string;
  readonly status: FirstCompletePaperSessionCertificationStatus;
  readonly generatedAtEpochMs: number;
  readonly preflightVerdict: FirstPaperSessionFinalPreflightVerdict;
  readonly manualProtocolStatus: FirstPaperSessionManualExecutionProtocolStatus;
  readonly closingStatus: FirstPaperSessionClosingStatus;
  readonly checks: readonly FirstCompletePaperSessionCertificationCheck[];
  readonly totalChecks: number;
  readonly passedChecks: number;
  readonly failedChecks: number;
  readonly certificationScorePercent: number;
  readonly certificationCandidate: boolean;
  readonly auditSummary: string;
  readonly checksum: string;
  readonly recommendation: string;
  readonly paperOnly: true;
  readonly liveMoneyAuthorization: false;
  readonly automaticExecutionAllowed: false;
  readonly automaticBetExecutionAllowed: false;
  readonly humanSupervisionRequired: true;
}

export interface FirstCompletePaperSessionCertificationTextReport {
  readonly status: FirstCompletePaperSessionCertificationStatus;
  readonly generatedAtEpochMs: number;
  readonly text: string;
  readonly paperOnly: true;
  readonly liveMoneyAuthorization: false;
  readonly automaticExecutionAllowed: false;
  readonly automaticBetExecutionAllowed: false;
  readonly humanSupervisionRequired: true;
}

export interface FirstCompletePaperSessionCertificationSuccess<T> {
  readonly ok: true;
  readonly value: T;
}

export interface FirstCompletePaperSessionCertificationFailure {
  readonly ok: false;
  readonly error: {
    readonly code: 'FIRST_COMPLETE_PAPER_SESSION_CERTIFICATION_ERROR';
    readonly message: string;
  };
}

export type FirstCompletePaperSessionCertificationResult<T> =
  | FirstCompletePaperSessionCertificationSuccess<T>
  | FirstCompletePaperSessionCertificationFailure;

/**
 * Institutional certification for the first complete supervised PAPER session.
 *
 * This certification evaluates protocol correctness, governance and auditability.
 * It does not certify profit, ROI, edge, live-money readiness or automatic
 * execution. Live money and automatic execution remain blocked.
 */
export class FirstCompletePaperSessionCertification {
  private readonly preflight: FirstPaperSessionFinalPreflightOrchestrator;
  private readonly manualProtocol: FirstPaperSessionManualExecutionProtocol;
  private readonly closingProtocol: FirstPaperSessionClosingProtocol;

  public constructor(repository: PaperEntryLedgerRepositoryPort) {
    this.preflight = new FirstPaperSessionFinalPreflightOrchestrator(repository);
    this.manualProtocol = new FirstPaperSessionManualExecutionProtocol(repository);
    this.closingProtocol = new FirstPaperSessionClosingProtocol(repository);
  }

  public async certify(
    input: FirstCompletePaperSessionCertificationInput,
    generatedAtEpochMs = Date.now(),
  ): Promise<FirstCompletePaperSessionCertificationResult<FirstCompletePaperSessionCertificationReport>> {
    const sessionId = typeof input.sessionId === 'string' ? input.sessionId.trim() : '';

    if (sessionId.length === 0) {
      return this.failure('sessionId is required');
    }

    const preflight = await this.preflight.evaluate({
      sessionId,
      operatorConfirmedLaunch: input.operatorConfirmedLaunch,
      runtimePaperAvailable: input.runtimePaperAvailable,
      snapshotPathAvailable: input.snapshotPathAvailable,
      ledgerPathConfigured: input.ledgerPathConfigured,
      minimumRecommendedLedgerEntries: input.minimumRecommendedLedgerEntries,
      maxDeniedByHudRatio: input.maxDeniedByHudRatio,
      maxRejectedByOperatorRatio: input.maxRejectedByOperatorRatio,
      operatorId: input.operatorId,
      tableId: input.tableId,
      strategyName: input.strategyName,
      bankrollLabel: input.bankrollLabel,
      plannedRounds: input.plannedRounds,
      notes: input.notes,
      allowNeedsReviewRecording: input.allowNeedsReviewRecording,
    }, generatedAtEpochMs);

    if (!preflight.ok) {
      return this.failure(preflight.error.message);
    }

    const manual = await this.manualProtocol.compose({
      sessionId,
      operatorConfirmedLaunch: input.operatorConfirmedLaunch,
      runtimePaperAvailable: input.runtimePaperAvailable,
      snapshotPathAvailable: input.snapshotPathAvailable,
      ledgerPathConfigured: input.ledgerPathConfigured,
      minimumRecommendedLedgerEntries: input.minimumRecommendedLedgerEntries,
      maxDeniedByHudRatio: input.maxDeniedByHudRatio,
      maxRejectedByOperatorRatio: input.maxRejectedByOperatorRatio,
      operatorId: input.operatorId,
      tableId: input.tableId,
      strategyName: input.strategyName,
      bankrollLabel: input.bankrollLabel,
      plannedRounds: input.plannedRounds,
      notes: input.notes,
      allowNeedsReviewRecording: input.allowNeedsReviewRecording,
    }, generatedAtEpochMs);

    if (!manual.ok) {
      return this.failure(manual.error.message);
    }

    const closing = await this.closingProtocol.close({
      sessionId,
      operatorConfirmedClose: input.operatorConfirmedClose,
      snapshotValidated: input.snapshotValidated,
      ledgerValidated: input.ledgerValidated,
      reportExported: input.reportExported,
      auditExported: input.auditExported,
      totalWins: input.totalWins,
      totalLosses: input.totalLosses,
      totalSkips: input.totalSkips,
      closingNotes: input.closingNotes,
      allowCloseWithReview: input.allowCloseWithReview,
    }, generatedAtEpochMs);

    if (!closing.ok) {
      return this.failure(closing.error.message);
    }

    const checks = this.buildChecks({
      preflightVerdict: preflight.value.verdict,
      manualProtocolStatus: manual.value.status,
      closingStatus: closing.value.status,
      certificationCandidate: closing.value.certificationCandidate,
      operatorConfirmedLaunch: input.operatorConfirmedLaunch === true,
      operatorConfirmedClose: input.operatorConfirmedClose === true,
      paperOnly: preflight.value.paperOnly && manual.value.paperOnly && closing.value.paperOnly,
      liveMoneyAuthorization: preflight.value.liveMoneyAuthorization || manual.value.liveMoneyAuthorization || closing.value.liveMoneyAuthorization,
      automaticExecutionAllowed: preflight.value.automaticExecutionAllowed || manual.value.automaticExecutionAllowed || closing.value.automaticExecutionAllowed,
      automaticBetExecutionAllowed: preflight.value.automaticBetExecutionAllowed || manual.value.automaticBetExecutionAllowed || closing.value.automaticBetExecutionAllowed,
      humanSupervisionRequired: preflight.value.humanSupervisionRequired && manual.value.humanSupervisionRequired && closing.value.humanSupervisionRequired,
    });

    const passedChecks = checks.filter((check) => check.passed).length;
    const failedChecks = checks.length - passedChecks;
    const certificationScorePercent = checks.length === 0
      ? 0
      : Number(((passedChecks / checks.length) * 100).toFixed(2));
    const status = this.resolveStatus({
      failedChecks,
      preflightVerdict: preflight.value.verdict,
      manualProtocolStatus: manual.value.status,
      closingStatus: closing.value.status,
      certificationCandidate: closing.value.certificationCandidate,
    });

    const certificationId = this.certificationIdFor(sessionId, generatedAtEpochMs);
    const auditSummary = this.auditSummary({
      status,
      certificationScorePercent,
      totalChecks: checks.length,
      passedChecks,
      failedChecks,
      preflightVerdict: preflight.value.verdict,
      manualProtocolStatus: manual.value.status,
      closingStatus: closing.value.status,
      certificationCandidate: closing.value.certificationCandidate,
    });

    const withoutChecksum = {
      certificationId,
      sessionId,
      status,
      generatedAtEpochMs,
      preflightVerdict: preflight.value.verdict,
      manualProtocolStatus: manual.value.status,
      closingStatus: closing.value.status,
      totalChecks: checks.length,
      passedChecks,
      failedChecks,
      certificationScorePercent,
      certificationCandidate: closing.value.certificationCandidate,
      auditSummary,
      paperOnly: true as const,
      liveMoneyAuthorization: false as const,
      automaticExecutionAllowed: false as const,
      automaticBetExecutionAllowed: false as const,
      humanSupervisionRequired: true as const,
    };

    return {
      ok: true,
      value: Object.freeze({
        ...withoutChecksum,
        checks: Object.freeze(checks),
        checksum: this.hash(withoutChecksum),
        recommendation: this.recommendationFor(status),
      }),
    };
  }

  public async textReport(
    input: FirstCompletePaperSessionCertificationInput,
    generatedAtEpochMs = Date.now(),
  ): Promise<FirstCompletePaperSessionCertificationResult<FirstCompletePaperSessionCertificationTextReport>> {
    const certified = await this.certify(input, generatedAtEpochMs);

    if (!certified.ok) {
      return certified;
    }

    const lines = [
      'RL.SYS CORE — FIRST COMPLETE PAPER SESSION CERTIFICATION',
      '========================================================',
      `Generated At EpochMs: ${certified.value.generatedAtEpochMs}`,
      `CertificationId: ${certified.value.certificationId}`,
      `SessionId: ${certified.value.sessionId}`,
      `Status: ${certified.value.status}`,
      `CertificationScorePercent: ${certified.value.certificationScorePercent}`,
      `CertificationCandidate: ${certified.value.certificationCandidate}`,
      `PreflightVerdict: ${certified.value.preflightVerdict}`,
      `ManualProtocolStatus: ${certified.value.manualProtocolStatus}`,
      `ClosingStatus: ${certified.value.closingStatus}`,
      `Checksum: ${certified.value.checksum}`,
      `Recommendation: ${certified.value.recommendation}`,
      '',
      'Checks:',
    ];

    for (const check of certified.value.checks) {
      lines.push(` - ${check.name}: ${check.passed ? 'PASS' : 'FAIL'} — ${check.message}`);
    }

    lines.push('');
    lines.push('Audit Summary:');
    lines.push(certified.value.auditSummary);
    lines.push('');
    lines.push('Governance:');
    lines.push('PaperOnly: true');
    lines.push('LiveMoneyAuthorization: false');
    lines.push('AutomaticExecutionAllowed: false');
    lines.push('AutomaticBetExecutionAllowed: false');
    lines.push('HumanSupervisionRequired: true');

    return {
      ok: true,
      value: Object.freeze({
        status: certified.value.status,
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

  private buildChecks(input: {
    readonly preflightVerdict: FirstPaperSessionFinalPreflightVerdict;
    readonly manualProtocolStatus: FirstPaperSessionManualExecutionProtocolStatus;
    readonly closingStatus: FirstPaperSessionClosingStatus;
    readonly certificationCandidate: boolean;
    readonly operatorConfirmedLaunch: boolean;
    readonly operatorConfirmedClose: boolean;
    readonly paperOnly: boolean;
    readonly liveMoneyAuthorization: boolean;
    readonly automaticExecutionAllowed: boolean;
    readonly automaticBetExecutionAllowed: boolean;
    readonly humanSupervisionRequired: boolean;
  }): readonly FirstCompletePaperSessionCertificationCheck[] {
    return Object.freeze([
      this.check('PREFLIGHT_GO', input.preflightVerdict === 'PAPER_OPERATIONAL_GO', `Preflight verdict is ${input.preflightVerdict}.`),
      this.check('MANUAL_PROTOCOL_READY', input.manualProtocolStatus === 'MANUAL_PROTOCOL_READY', `Manual protocol status is ${input.manualProtocolStatus}.`),
      this.check('SESSION_CLOSED', input.closingStatus === 'SESSION_CLOSED', `Closing status is ${input.closingStatus}.`),
      this.check('CERTIFICATION_CANDIDATE', input.certificationCandidate, `Certification candidate is ${input.certificationCandidate}.`),
      this.check('OPERATOR_CONFIRMED_LAUNCH', input.operatorConfirmedLaunch, `Operator confirmed launch is ${input.operatorConfirmedLaunch}.`),
      this.check('OPERATOR_CONFIRMED_CLOSE', input.operatorConfirmedClose, `Operator confirmed close is ${input.operatorConfirmedClose}.`),
      this.check('PAPER_ONLY', input.paperOnly, `Paper-only governance is ${input.paperOnly}.`),
      this.check('LIVE_MONEY_BLOCKED', !input.liveMoneyAuthorization, `Live money authorization is ${input.liveMoneyAuthorization}.`),
      this.check('AUTOMATIC_EXECUTION_BLOCKED', !input.automaticExecutionAllowed, `Automatic execution allowed is ${input.automaticExecutionAllowed}.`),
      this.check('AUTOMATIC_BET_EXECUTION_BLOCKED', !input.automaticBetExecutionAllowed, `Automatic bet execution allowed is ${input.automaticBetExecutionAllowed}.`),
      this.check('HUMAN_SUPERVISION_REQUIRED', input.humanSupervisionRequired, `Human supervision required is ${input.humanSupervisionRequired}.`),
    ]);
  }

  private check(
    name: string,
    passed: boolean,
    message: string,
  ): FirstCompletePaperSessionCertificationCheck {
    return Object.freeze({ name, passed, message });
  }

  private resolveStatus(input: {
    readonly failedChecks: number;
    readonly preflightVerdict: FirstPaperSessionFinalPreflightVerdict;
    readonly manualProtocolStatus: FirstPaperSessionManualExecutionProtocolStatus;
    readonly closingStatus: FirstPaperSessionClosingStatus;
    readonly certificationCandidate: boolean;
  }): FirstCompletePaperSessionCertificationStatus {
    if (
      input.failedChecks === 0 &&
      input.preflightVerdict === 'PAPER_OPERATIONAL_GO' &&
      input.manualProtocolStatus === 'MANUAL_PROTOCOL_READY' &&
      input.closingStatus === 'SESSION_CLOSED' &&
      input.certificationCandidate
    ) {
      return 'PAPER_SESSION_CERTIFIED';
    }

    if (
      input.preflightVerdict === 'PAPER_OPERATIONAL_BLOCKED' ||
      input.manualProtocolStatus === 'MANUAL_PROTOCOL_BLOCKED' ||
      input.closingStatus === 'SESSION_CLOSING_BLOCKED'
    ) {
      return 'PAPER_SESSION_CERTIFICATION_REJECTED';
    }

    return 'PAPER_SESSION_CERTIFIED_WITH_REVIEW';
  }

  private recommendationFor(status: FirstCompletePaperSessionCertificationStatus): string {
    if (status === 'PAPER_SESSION_CERTIFIED') {
      return 'First PAPER session is institutionally certified for protocol correctness. Live money remains blocked.';
    }

    if (status === 'PAPER_SESSION_CERTIFIED_WITH_REVIEW') {
      return 'First PAPER session requires review before being accepted as a repeatable operational template.';
    }

    return 'First PAPER session certification is rejected until protocol, closing or governance failures are resolved.';
  }

  private auditSummary(input: {
    readonly status: FirstCompletePaperSessionCertificationStatus;
    readonly certificationScorePercent: number;
    readonly totalChecks: number;
    readonly passedChecks: number;
    readonly failedChecks: number;
    readonly preflightVerdict: FirstPaperSessionFinalPreflightVerdict;
    readonly manualProtocolStatus: FirstPaperSessionManualExecutionProtocolStatus;
    readonly closingStatus: FirstPaperSessionClosingStatus;
    readonly certificationCandidate: boolean;
  }): string {
    return [
      `CertificationStatus=${input.status}`,
      `CertificationScorePercent=${input.certificationScorePercent}`,
      `TotalChecks=${input.totalChecks}`,
      `PassedChecks=${input.passedChecks}`,
      `FailedChecks=${input.failedChecks}`,
      `PreflightVerdict=${input.preflightVerdict}`,
      `ManualProtocolStatus=${input.manualProtocolStatus}`,
      `ClosingStatus=${input.closingStatus}`,
      `CertificationCandidate=${input.certificationCandidate}`,
      'CertifiesProfit=false',
      'CertifiesLiveMoney=false',
      'PaperOnly=true',
      'LiveMoneyAuthorization=false',
      'AutomaticExecutionAllowed=false',
      'AutomaticBetExecutionAllowed=false',
      'HumanSupervisionRequired=true',
    ].join('; ');
  }

  private certificationIdFor(sessionId: string, generatedAtEpochMs: number): string {
    return `first-paper-cert-${this.hash({ sessionId, generatedAtEpochMs }).slice(0, 16)}`;
  }

  private hash(value: unknown): string {
    return createHash('sha256')
      .update(JSON.stringify(value))
      .digest('hex');
  }

  private failure(message: string): FirstCompletePaperSessionCertificationFailure {
    return {
      ok: false,
      error: {
        code: 'FIRST_COMPLETE_PAPER_SESSION_CERTIFICATION_ERROR',
        message,
      },
    };
  }
}
