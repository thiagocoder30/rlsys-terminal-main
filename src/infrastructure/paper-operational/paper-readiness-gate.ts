import { PaperSessionLifecycleSupervisor } from './paper-session-lifecycle-supervisor';
import type {
  PaperSessionLifecycleReport,
  PaperSessionLifecycleSupervisorInput,
} from './paper-session-lifecycle-supervisor';

export type PaperReadinessGateStatus =
  | 'PAPER_BLOCKED'
  | 'PAPER_NEEDS_REVIEW'
  | 'PAPER_READY'
  | 'PAPER_CERTIFIED';

export type PaperReadinessGateReason =
  | 'PAPER_GATE_CERTIFIED'
  | 'PAPER_GATE_READY'
  | 'PAPER_GATE_NEEDS_REVIEW'
  | 'PAPER_GATE_BLOCKED'
  | 'INVALID_PAPER_READINESS_GATE_INPUT'
  | 'LIVE_MONEY_FORBIDDEN';

export interface PaperReadinessGateInput extends PaperSessionLifecycleSupervisorInput {
  readonly minimumReadinessScoreForReady: number;
  readonly minimumReadinessScoreForCertified: number;
}

export interface PaperReadinessGateReport {
  readonly sessionId: string;
  readonly operatorId: string;
  readonly status: PaperReadinessGateStatus;
  readonly reason: PaperReadinessGateReason;
  readonly paperAuthorized: boolean;
  readonly certified: boolean;
  readonly readinessScore: number;
  readonly lifecycleDecision: string;
  readonly certificationStatus: string;
  readonly performanceDecision: string;
  readonly behaviorReadiness: string;
  readonly lifecycle: PaperSessionLifecycleReport;
  readonly productionMoneyAllowed: false;
  readonly liveMoneyAuthorization: false;
  readonly explanation: string;
}

export type PaperReadinessGateResult =
  | {
      readonly ok: true;
      readonly value: PaperReadinessGateReport;
    }
  | {
      readonly ok: false;
      readonly error: {
        readonly reason: PaperReadinessGateReason;
        readonly message: string;
        readonly productionMoneyAllowed: false;
        readonly liveMoneyAuthorization: false;
      };
    };

/**
 * PaperReadinessGate
 *
 * Gate institucional final antes de qualquer operação PAPER. Ele consome o
 * PaperSessionLifecycleSupervisor como fonte central e traduz o ciclo em uma
 * autorização PAPER explícita, auditável e defensiva.
 *
 * O gate nunca autoriza live money. A autorização positiva é somente PAPER.
 *
 * Complexidade: O(n + m), herdada dos módulos internos, mantendo memória baixa
 * para baseline A10s/Helio P22.
 */
export class PaperReadinessGate {
  private readonly lifecycleSupervisor: PaperSessionLifecycleSupervisor;

  public constructor(lifecycleSupervisor: PaperSessionLifecycleSupervisor = new PaperSessionLifecycleSupervisor()) {
    this.lifecycleSupervisor = lifecycleSupervisor;
  }

  public evaluate(input: PaperReadinessGateInput): PaperReadinessGateResult {
    if (input.productionMoneyAllowed === true || input.liveMoneyAuthorization === true) {
      return this.fail('LIVE_MONEY_FORBIDDEN', 'Paper readiness gate cannot run with live money flags enabled.');
    }

    const invalidReason = this.validateGateInput(input);

    if (invalidReason !== null) {
      return this.fail('INVALID_PAPER_READINESS_GATE_INPUT', invalidReason);
    }

    const lifecycle = this.lifecycleSupervisor.supervise({
      filePath: input.filePath,
      operatorId: input.operatorId,
      sessionId: input.sessionId,
      tradeId: input.tradeId,
      balance: input.balance,
      stake: input.stake,
      startedAtEpochMs: input.startedAtEpochMs,
      maxBytes: input.maxBytes,
      minimumSuccessfulSteps: input.minimumSuccessfulSteps,
      minimumPersistedSteps: input.minimumPersistedSteps,
      requireAuditChain: input.requireAuditChain,
      performanceTrades: input.performanceTrades,
      performancePolicy: input.performancePolicy,
      behaviorEvents: input.behaviorEvents,
      behaviorPolicy: input.behaviorPolicy,
      productionMoneyAllowed: false,
      liveMoneyAuthorization: false,
    });

    if (!lifecycle.ok) {
      return this.fail('PAPER_GATE_BLOCKED', lifecycle.error.message);
    }

    const status = this.mapStatus(input, lifecycle.value);

    return {
      ok: true,
      value: {
        sessionId: input.sessionId,
        operatorId: input.operatorId,
        status,
        reason: this.reasonForStatus(status),
        paperAuthorized: status === 'PAPER_READY' || status === 'PAPER_CERTIFIED',
        certified: status === 'PAPER_CERTIFIED',
        readinessScore: lifecycle.value.readinessScore,
        lifecycleDecision: lifecycle.value.decision,
        certificationStatus: lifecycle.value.certificationStatus,
        performanceDecision: lifecycle.value.performanceDecision,
        behaviorReadiness: lifecycle.value.behaviorReadiness,
        lifecycle: lifecycle.value,
        productionMoneyAllowed: false,
        liveMoneyAuthorization: false,
        explanation: this.explain(status),
      },
    };
  }

  private mapStatus(input: PaperReadinessGateInput, lifecycle: PaperSessionLifecycleReport): PaperReadinessGateStatus {
    if (lifecycle.decision === 'PAPER_SESSION_BLOCKED') {
      return 'PAPER_BLOCKED';
    }

    if (
      lifecycle.decision === 'PAPER_SESSION_NEEDS_REVIEW' ||
      lifecycle.readinessScore < input.minimumReadinessScoreForReady
    ) {
      return 'PAPER_NEEDS_REVIEW';
    }

    if (
      lifecycle.decision === 'PAPER_SESSION_CERTIFIED' &&
      lifecycle.readinessScore >= input.minimumReadinessScoreForCertified
    ) {
      return 'PAPER_CERTIFIED';
    }

    return 'PAPER_READY';
  }

  private reasonForStatus(status: PaperReadinessGateStatus): PaperReadinessGateReason {
    if (status === 'PAPER_CERTIFIED') {
      return 'PAPER_GATE_CERTIFIED';
    }

    if (status === 'PAPER_READY') {
      return 'PAPER_GATE_READY';
    }

    if (status === 'PAPER_NEEDS_REVIEW') {
      return 'PAPER_GATE_NEEDS_REVIEW';
    }

    return 'PAPER_GATE_BLOCKED';
  }

  private explain(status: PaperReadinessGateStatus): string {
    if (status === 'PAPER_CERTIFIED') {
      return 'Gate PAPER certificado: ciclo, performance e operador aprovados institucionalmente.';
    }

    if (status === 'PAPER_READY') {
      return 'Gate PAPER pronto para operação supervisionada, ainda sem certificação plena.';
    }

    if (status === 'PAPER_NEEDS_REVIEW') {
      return 'Gate PAPER requer revisão institucional antes de operar.';
    }

    return 'Gate PAPER bloqueado por risco institucional.';
  }

  private validateGateInput(input: PaperReadinessGateInput): string | null {
    if (typeof input !== 'object' || input === null) {
      return 'input must be an object.';
    }

    if (!Number.isFinite(input.minimumReadinessScoreForReady) || input.minimumReadinessScoreForReady < 0 || input.minimumReadinessScoreForReady > 1) {
      return 'minimumReadinessScoreForReady must be a finite score between 0 and 1.';
    }

    if (!Number.isFinite(input.minimumReadinessScoreForCertified) || input.minimumReadinessScoreForCertified < 0 || input.minimumReadinessScoreForCertified > 1) {
      return 'minimumReadinessScoreForCertified must be a finite score between 0 and 1.';
    }

    if (input.minimumReadinessScoreForReady > input.minimumReadinessScoreForCertified) {
      return 'minimumReadinessScoreForReady cannot be greater than minimumReadinessScoreForCertified.';
    }

    return null;
  }

  private fail(reason: PaperReadinessGateReason, message: string): PaperReadinessGateResult {
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
