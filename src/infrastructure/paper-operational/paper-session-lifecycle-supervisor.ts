import { PaperCertificationRuntime } from './paper-certification-runtime';
import type { PaperCertificationRuntimeReport } from './paper-certification-runtime';
import { PaperPerformanceAnalyzer } from './paper-performance-analyzer';
import type {
  PaperPerformancePolicy,
  PaperPerformanceReport,
  PaperPerformanceTrade,
} from './paper-performance-analyzer';
import { OperatorBehaviorMonitor } from './operator-behavior-monitor';
import type {
  OperatorBehaviorEvent,
  OperatorBehaviorPolicy,
  OperatorBehaviorReport,
} from './operator-behavior-monitor';

export type PaperLifecycleDecision =
  | 'PAPER_SESSION_BLOCKED'
  | 'PAPER_SESSION_NEEDS_REVIEW'
  | 'PAPER_SESSION_READY'
  | 'PAPER_SESSION_CERTIFIED';

export type PaperLifecycleReason =
  | 'PAPER_SESSION_LIFECYCLE_CERTIFIED'
  | 'PAPER_SESSION_LIFECYCLE_READY'
  | 'PAPER_SESSION_LIFECYCLE_NEEDS_REVIEW'
  | 'PAPER_SESSION_LIFECYCLE_BLOCKED'
  | 'INVALID_PAPER_SESSION_LIFECYCLE_INPUT'
  | 'LIVE_MONEY_FORBIDDEN';

export interface PaperSessionLifecycleSupervisorInput {
  readonly filePath: string;
  readonly operatorId: string;
  readonly sessionId: string;
  readonly tradeId: string;
  readonly balance: number;
  readonly stake: number;
  readonly startedAtEpochMs: number;
  readonly maxBytes: number;
  readonly minimumSuccessfulSteps: number;
  readonly minimumPersistedSteps: number;
  readonly requireAuditChain: boolean;
  readonly performanceTrades: readonly PaperPerformanceTrade[];
  readonly performancePolicy: PaperPerformancePolicy;
  readonly behaviorEvents: readonly OperatorBehaviorEvent[];
  readonly behaviorPolicy: OperatorBehaviorPolicy;
  readonly productionMoneyAllowed?: boolean;
  readonly liveMoneyAuthorization?: boolean;
}

export interface PaperSessionLifecycleReport {
  readonly sessionId: string;
  readonly operatorId: string;
  readonly decision: PaperLifecycleDecision;
  readonly reason: PaperLifecycleReason;
  readonly certificationStatus: string;
  readonly performanceDecision: string;
  readonly behaviorReadiness: string;
  readonly readinessScore: number;
  readonly certification: PaperCertificationRuntimeReport;
  readonly performance: PaperPerformanceReport;
  readonly behavior: OperatorBehaviorReport;
  readonly productionMoneyAllowed: false;
  readonly liveMoneyAuthorization: false;
  readonly explanation: string;
}

export type PaperSessionLifecycleResult =
  | {
      readonly ok: true;
      readonly value: PaperSessionLifecycleReport;
    }
  | {
      readonly ok: false;
      readonly error: {
        readonly reason: PaperLifecycleReason;
        readonly message: string;
        readonly productionMoneyAllowed: false;
        readonly liveMoneyAuthorization: false;
      };
    };

const SCORE_PRECISION = 10_000;

/**
 * PaperSessionLifecycleSupervisor
 *
 * Controlador mestre de ciclo PAPER. Consolida certificação institucional,
 * performance PAPER e comportamento do operador em uma decisão única de ciclo.
 *
 * Este supervisor não cria entrada automática, não opera live money e não
 * substitui os motores especializados. Ele apenas orquestra e classifica.
 *
 * Complexidade: O(n + m), onde n = trades e m = eventos comportamentais.
 * Memória adicional O(1), adequada ao baseline A10s/Helio P22.
 */
export class PaperSessionLifecycleSupervisor {
  private readonly certificationRuntime: PaperCertificationRuntime;
  private readonly performanceAnalyzer: PaperPerformanceAnalyzer;
  private readonly behaviorMonitor: OperatorBehaviorMonitor;

  public constructor(
    certificationRuntime: PaperCertificationRuntime = new PaperCertificationRuntime(),
    performanceAnalyzer: PaperPerformanceAnalyzer = new PaperPerformanceAnalyzer(),
    behaviorMonitor: OperatorBehaviorMonitor = new OperatorBehaviorMonitor(),
  ) {
    this.certificationRuntime = certificationRuntime;
    this.performanceAnalyzer = performanceAnalyzer;
    this.behaviorMonitor = behaviorMonitor;
  }

  public supervise(input: PaperSessionLifecycleSupervisorInput): PaperSessionLifecycleResult {
    if (input.productionMoneyAllowed === true || input.liveMoneyAuthorization === true) {
      return this.fail('LIVE_MONEY_FORBIDDEN', 'Paper lifecycle supervisor cannot run with live money flags enabled.');
    }

    const invalidReason = this.validateInput(input);

    if (invalidReason !== null) {
      return this.fail('INVALID_PAPER_SESSION_LIFECYCLE_INPUT', invalidReason);
    }

    const certification = this.certificationRuntime.certify({
      filePath: input.filePath,
      sessionId: input.sessionId,
      tradeId: input.tradeId,
      balance: input.balance,
      stake: input.stake,
      startedAtEpochMs: input.startedAtEpochMs,
      maxBytes: input.maxBytes,
      minimumSuccessfulSteps: input.minimumSuccessfulSteps,
      minimumPersistedSteps: input.minimumPersistedSteps,
      requireAuditChain: input.requireAuditChain,
      productionMoneyAllowed: false,
      liveMoneyAuthorization: false,
    });

    if (!certification.ok) {
      return this.fail('PAPER_SESSION_LIFECYCLE_BLOCKED', certification.error.message);
    }

    const performance = this.performanceAnalyzer.analyze({
      sessionId: input.sessionId,
      initialBalance: input.balance,
      trades: input.performanceTrades,
      policy: input.performancePolicy,
      productionMoneyAllowed: false,
      liveMoneyAuthorization: false,
    });

    if (!performance.ok) {
      return this.fail('PAPER_SESSION_LIFECYCLE_BLOCKED', performance.error.message);
    }

    const behavior = this.behaviorMonitor.evaluate({
      operatorId: input.operatorId,
      sessionId: input.sessionId,
      events: input.behaviorEvents,
      policy: input.behaviorPolicy,
      productionMoneyAllowed: false,
      liveMoneyAuthorization: false,
    });

    if (!behavior.ok) {
      return this.fail('PAPER_SESSION_LIFECYCLE_BLOCKED', behavior.error.message);
    }

    const readinessScore = this.computeReadinessScore(
      certification.value.status,
      performance.value.certificationImpact,
      behavior.value.readiness,
    );
    const decision = this.classify(certification.value, performance.value, behavior.value, readinessScore);

    return {
      ok: true,
      value: {
        sessionId: input.sessionId,
        operatorId: input.operatorId,
        decision,
        reason: this.reasonForDecision(decision),
        certificationStatus: certification.value.status,
        performanceDecision: performance.value.decision,
        behaviorReadiness: behavior.value.readiness,
        readinessScore,
        certification: certification.value,
        performance: performance.value,
        behavior: behavior.value,
        productionMoneyAllowed: false,
        liveMoneyAuthorization: false,
        explanation: this.explain(decision),
      },
    };
  }

  private classify(
    certification: PaperCertificationRuntimeReport,
    performance: PaperPerformanceReport,
    behavior: OperatorBehaviorReport,
    readinessScore: number,
  ): PaperLifecycleDecision {
    if (
      certification.status === 'BLOCKED' ||
      performance.certificationImpact === 'CERTIFICATION_BLOCKING' ||
      behavior.readiness === 'OPERATOR_BLOCKED'
    ) {
      return 'PAPER_SESSION_BLOCKED';
    }

    if (
      certification.status === 'NEEDS_REVIEW' ||
      performance.certificationImpact === 'CERTIFICATION_NEEDS_REVIEW' ||
      behavior.readiness === 'OPERATOR_COOLDOWN' ||
      readinessScore < 0.55
    ) {
      return 'PAPER_SESSION_NEEDS_REVIEW';
    }

    if (
      certification.status === 'PAPER_CERTIFIED' &&
      performance.certificationImpact === 'CERTIFICATION_SUPPORTIVE' &&
      behavior.readiness === 'OPERATOR_STABLE' &&
      readinessScore >= 0.85
    ) {
      return 'PAPER_SESSION_CERTIFIED';
    }

    return 'PAPER_SESSION_READY';
  }

  private computeReadinessScore(
    certificationStatus: string,
    performanceImpact: string,
    behaviorReadiness: string,
  ): number {
    const certificationScore = certificationStatus === 'PAPER_CERTIFIED'
      ? 1
      : certificationStatus === 'PAPER_READY'
        ? 0.75
        : certificationStatus === 'NEEDS_REVIEW'
          ? 0.45
          : 0;

    const performanceScore = performanceImpact === 'CERTIFICATION_SUPPORTIVE'
      ? 1
      : performanceImpact === 'CERTIFICATION_NEEDS_REVIEW'
        ? 0.5
        : 0;

    const behaviorScore = behaviorReadiness === 'OPERATOR_STABLE'
      ? 1
      : behaviorReadiness === 'OPERATOR_OBSERVE'
        ? 0.75
        : behaviorReadiness === 'OPERATOR_COOLDOWN'
          ? 0.35
          : 0;

    return Math.round(((certificationScore * 0.45) + (performanceScore * 0.30) + (behaviorScore * 0.25)) * SCORE_PRECISION) / SCORE_PRECISION;
  }

  private reasonForDecision(decision: PaperLifecycleDecision): PaperLifecycleReason {
    if (decision === 'PAPER_SESSION_CERTIFIED') {
      return 'PAPER_SESSION_LIFECYCLE_CERTIFIED';
    }

    if (decision === 'PAPER_SESSION_READY') {
      return 'PAPER_SESSION_LIFECYCLE_READY';
    }

    if (decision === 'PAPER_SESSION_NEEDS_REVIEW') {
      return 'PAPER_SESSION_LIFECYCLE_NEEDS_REVIEW';
    }

    return 'PAPER_SESSION_LIFECYCLE_BLOCKED';
  }

  private explain(decision: PaperLifecycleDecision): string {
    if (decision === 'PAPER_SESSION_CERTIFIED') {
      return 'Sessão PAPER certificada por ciclo completo: certificação, performance e operador estáveis.';
    }

    if (decision === 'PAPER_SESSION_READY') {
      return 'Sessão PAPER pronta para observação supervisionada, ainda sem certificação plena.';
    }

    if (decision === 'PAPER_SESSION_NEEDS_REVIEW') {
      return 'Sessão PAPER requer revisão institucional antes de execução operacional.';
    }

    return 'Sessão PAPER bloqueada por risco em certificação, performance ou comportamento.';
  }

  private validateInput(input: PaperSessionLifecycleSupervisorInput): string | null {
    if (typeof input !== 'object' || input === null) {
      return 'input must be an object.';
    }

    if (!this.isSafeToken(input.operatorId, 3, 96)) {
      return 'operatorId must be a safe token with 3 to 96 characters.';
    }

    if (!this.isSafeToken(input.sessionId, 3, 96)) {
      return 'sessionId must be a safe token with 3 to 96 characters.';
    }

    if (!this.isSafeToken(input.tradeId, 3, 96)) {
      return 'tradeId must be a safe token with 3 to 96 characters.';
    }

    if (typeof input.filePath !== 'string' || input.filePath.trim().length < 3) {
      return 'filePath must be a valid path string.';
    }

    if (!Number.isFinite(input.balance) || input.balance <= 0) {
      return 'balance must be positive.';
    }

    if (!Number.isFinite(input.stake) || input.stake <= 0) {
      return 'stake must be positive.';
    }

    if (!Number.isInteger(input.startedAtEpochMs) || input.startedAtEpochMs <= 0) {
      return 'startedAtEpochMs must be a positive integer.';
    }

    if (!Number.isInteger(input.maxBytes) || input.maxBytes < 512 || input.maxBytes > 5_000_000) {
      return 'maxBytes must be between 512 and 5000000.';
    }

    if (!Array.isArray(input.performanceTrades) || input.performanceTrades.length === 0) {
      return 'performanceTrades must be a non-empty array.';
    }

    if (!Array.isArray(input.behaviorEvents) || input.behaviorEvents.length === 0) {
      return 'behaviorEvents must be a non-empty array.';
    }

    return null;
  }

  private isSafeToken(value: unknown, min: number, max: number): value is string {
    return (
      typeof value === 'string' &&
      value.length >= min &&
      value.length <= max &&
      /^[0-9A-Za-z._:-]+$/.test(value)
    );
  }

  private fail(reason: PaperLifecycleReason, message: string): PaperSessionLifecycleResult {
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
