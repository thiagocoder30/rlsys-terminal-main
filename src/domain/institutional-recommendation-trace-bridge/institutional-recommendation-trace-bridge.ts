export type RecommendationBridgeDecision =
  | 'PAPER_FAVORAVEL'
  | 'OBSERVAR'
  | 'NAO_UTILIZAR';

export type RecommendationBridgeSeverity =
  | 'INFO'
  | 'WARNING'
  | 'BLOCKER';

export type RecommendationBridgeStatus =
  | 'BRIDGE_TRACE_READY'
  | 'BRIDGE_TRACE_REVIEW'
  | 'BRIDGE_TRACE_BLOCKED';

export type RecommendationBridgeReason =
  | 'PAPER_ONLY_POLICY_LOCK'
  | 'RECOMMENDATION_READY'
  | 'RECOMMENDATION_OBSERVE'
  | 'RECOMMENDATION_BLOCKED'
  | 'TRACE_NODE_CREATED'
  | 'EXPLANATION_SIGNAL_CREATED'
  | 'AUDIT_EVENT_CREATED'
  | 'LEDGER_EVENT_CREATED'
  | 'DEFENSIVE_BLOCK_ACTIVE'
  | 'POLICY_LOCK_ACTIVE';

export interface RecommendationBridgeInput {
  readonly recommendationId: string;
  readonly sessionId: string;
  readonly strategyId: string;
  readonly tableId: string;
  readonly decision: RecommendationBridgeDecision;
  readonly institutionalScore: number;
  readonly learningScore: number;
  readonly defensiveBlock: boolean;
  readonly occurredAtEpochMs: number;
  readonly reasons: readonly string[];
}

export interface RecommendationBridgePolicy {
  readonly minimumTraceReadyScore: number;
  readonly minimumTraceReviewScore: number;
  readonly productionMoneyAllowed: boolean;
  readonly liveMoneyAuthorization: boolean;
}

export interface RecommendationTraceNode {
  readonly nodeId: string;
  readonly label: string;
  readonly status: 'PASS' | 'WARN' | 'BLOCK';
  readonly weight: number;
  readonly score: number;
  readonly message: string;
}

export interface RecommendationExplanationSignal {
  readonly category:
    | 'POLICY'
    | 'RECOMMENDATION'
    | 'LEARNING'
    | 'RISK'
    | 'OPERATOR'
    | 'SYSTEM';
  readonly severity: RecommendationBridgeSeverity;
  readonly code: string;
  readonly message: string;
  readonly score: number;
}

export interface RecommendationAuditEvent {
  readonly eventId: string;
  readonly sessionId: string;
  readonly occurredAtEpochMs: number;
  readonly type: 'HUD_DECISION' | 'TRACE_CREATED' | 'EXPLANATION_CREATED' | 'RISK_EVENT';
  readonly severity: RecommendationBridgeSeverity;
  readonly source: string;
  readonly message: string;
}

export interface RecommendationLedgerEvent {
  readonly eventId: string;
  readonly sessionId: string;
  readonly occurredAtEpochMs: number;
  readonly type:
    | 'HUD_DECISION'
    | 'TRACE_CREATED'
    | 'EXPLANATION_CREATED'
    | 'RISK_EVENT';
  readonly severity: RecommendationBridgeSeverity;
  readonly source: string;
  readonly message: string;
}

export interface RecommendationTraceBridgeReport {
  readonly recommendationId: string;
  readonly sessionId: string;
  readonly strategyId: string;
  readonly tableId: string;
  readonly status: RecommendationBridgeStatus;
  readonly decision: RecommendationBridgeDecision;
  readonly traceNodes: readonly RecommendationTraceNode[];
  readonly explanationSignals: readonly RecommendationExplanationSignal[];
  readonly auditEvents: readonly RecommendationAuditEvent[];
  readonly ledgerEvents: readonly RecommendationLedgerEvent[];
  readonly reasons: readonly RecommendationBridgeReason[];
  readonly productionMoneyAllowed: false;
  readonly liveMoneyAuthorization: false;
  readonly paperOnly: true;
}

export interface RecommendationTraceBridgeFailure {
  readonly code: 'INVALID_RECOMMENDATION_TRACE_BRIDGE_INPUT';
  readonly message: string;
}

export type RecommendationTraceBridgeResult =
  | {
      readonly ok: true;
      readonly value: RecommendationTraceBridgeReport;
    }
  | {
      readonly ok: false;
      readonly error: RecommendationTraceBridgeFailure;
    };

const DEFAULT_POLICY: RecommendationBridgePolicy = Object.freeze({
  minimumTraceReadyScore: 0.72,
  minimumTraceReviewScore: 0.48,
  productionMoneyAllowed: false,
  liveMoneyAuthorization: false,
});

const clamp01 = (value: number): number => {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
};

const round4 = (value: number): number => Math.round(value * 10000) / 10000;

export class InstitutionalRecommendationTraceBridge {
  private readonly policy: RecommendationBridgePolicy;

  public constructor(policy: RecommendationBridgePolicy = DEFAULT_POLICY) {
    this.policy = Object.freeze({
      minimumTraceReadyScore: policy.minimumTraceReadyScore,
      minimumTraceReviewScore: policy.minimumTraceReviewScore,
      productionMoneyAllowed: policy.productionMoneyAllowed,
      liveMoneyAuthorization: policy.liveMoneyAuthorization,
    });
  }

  /**
   * Bridges a recommendation into trace, explanation, audit and ledger DTOs.
   * Complexity: O(r), where r is the number of recommendation reasons.
   * This bridge is pure, deterministic, idempotent and PAPER-only.
   */
  public bridge(
    input: RecommendationBridgeInput,
  ): RecommendationTraceBridgeResult {
    const validationFailure = this.validate(input);

    if (validationFailure !== null) {
      return {
        ok: false,
        error: validationFailure,
      };
    }

    const severity = this.resolveSeverity(input);
    const traceNodes = this.createTraceNodes(input);
    const explanationSignals = this.createExplanationSignals(input, severity);
    const auditEvents = this.createAuditEvents(input, severity);
    const ledgerEvents = this.createLedgerEvents(auditEvents);
    const reasons = this.resolveReasons(input);
    const status = this.resolveStatus(input, reasons);

    return {
      ok: true,
      value: Object.freeze({
        recommendationId: input.recommendationId,
        sessionId: input.sessionId,
        strategyId: input.strategyId,
        tableId: input.tableId,
        status,
        decision: input.decision,
        traceNodes: Object.freeze(traceNodes),
        explanationSignals: Object.freeze(explanationSignals),
        auditEvents: Object.freeze(auditEvents),
        ledgerEvents: Object.freeze(ledgerEvents),
        reasons: Object.freeze(reasons),
        productionMoneyAllowed: false,
        liveMoneyAuthorization: false,
        paperOnly: true,
      }),
    };
  }

  private resolveSeverity(input: RecommendationBridgeInput): RecommendationBridgeSeverity {
    if (input.defensiveBlock || input.decision === 'NAO_UTILIZAR') {
      return 'BLOCKER';
    }

    if (input.decision === 'OBSERVAR') {
      return 'WARNING';
    }

    return 'INFO';
  }

  private createTraceNodes(input: RecommendationBridgeInput): RecommendationTraceNode[] {
    const recommendationStatus =
      input.decision === 'PAPER_FAVORAVEL'
        ? 'PASS'
        : input.decision === 'OBSERVAR'
          ? 'WARN'
          : 'BLOCK';

    const learningStatus =
      input.learningScore >= this.policy.minimumTraceReadyScore
        ? 'PASS'
        : input.learningScore >= this.policy.minimumTraceReviewScore
          ? 'WARN'
          : 'BLOCK';

    const defensiveStatus = input.defensiveBlock ? 'BLOCK' : 'PASS';

    return [
      Object.freeze({
        nodeId: `${input.recommendationId}:recommendation`,
        label: 'Institutional Recommendation',
        status: recommendationStatus,
        weight: 1,
        score: input.institutionalScore,
        message: `Decisão institucional: ${input.decision}.`,
      }),
      Object.freeze({
        nodeId: `${input.recommendationId}:learning`,
        label: 'Validated Learning',
        status: learningStatus,
        weight: 1,
        score: input.learningScore,
        message: 'Aprendizado validado aplicado apenas ao contexto PAPER.',
      }),
      Object.freeze({
        nodeId: `${input.recommendationId}:defensive-policy`,
        label: 'Defensive Policy',
        status: defensiveStatus,
        weight: 1,
        score: input.defensiveBlock ? 0 : 1,
        message: input.defensiveBlock
          ? 'Bloqueio defensivo ativo.'
          : 'Política defensiva preservada.',
      }),
    ];
  }

  private createExplanationSignals(
    input: RecommendationBridgeInput,
    severity: RecommendationBridgeSeverity,
  ): RecommendationExplanationSignal[] {
    const signals: RecommendationExplanationSignal[] = [
      Object.freeze({
        category: 'POLICY',
        severity: 'INFO',
        code: 'PAPER_ONLY_POLICY_LOCK',
        message: 'Sistema permanece travado em modo PAPER.',
        score: 1,
      }),
      Object.freeze({
        category: 'RECOMMENDATION',
        severity,
        code: `RECOMMENDATION_${input.decision}`,
        message: `Recomendação institucional gerada: ${input.decision}.`,
        score: input.institutionalScore,
      }),
      Object.freeze({
        category: 'LEARNING',
        severity: input.learningScore >= this.policy.minimumTraceReviewScore ? 'INFO' : 'WARNING',
        code: 'VALIDATED_LEARNING_SCORE',
        message: 'Score de aprendizado validado incorporado à recomendação.',
        score: input.learningScore,
      }),
    ];

    for (const reason of input.reasons) {
      signals.push(
        Object.freeze({
          category: this.mapReasonCategory(reason),
          severity: reason.includes('BLOCKED') || reason.includes('REJECTED')
            ? 'BLOCKER'
            : reason.includes('WEAK') || reason.includes('UNCERTAIN')
              ? 'WARNING'
              : 'INFO',
          code: reason,
          message: `Razão institucional: ${reason}.`,
          score: this.reasonScore(reason, input),
        }),
      );
    }

    return signals;
  }

  private createAuditEvents(
    input: RecommendationBridgeInput,
    severity: RecommendationBridgeSeverity,
  ): RecommendationAuditEvent[] {
    return [
      Object.freeze({
        eventId: `${input.recommendationId}:audit:decision`,
        sessionId: input.sessionId,
        occurredAtEpochMs: input.occurredAtEpochMs,
        type: 'HUD_DECISION',
        severity,
        source: 'institutional-recommendation',
        message: `Decisão institucional PAPER: ${input.decision}.`,
      }),
      Object.freeze({
        eventId: `${input.recommendationId}:audit:trace`,
        sessionId: input.sessionId,
        occurredAtEpochMs: input.occurredAtEpochMs + 1,
        type: 'TRACE_CREATED',
        severity: input.defensiveBlock ? 'BLOCKER' : 'INFO',
        source: 'institutional-recommendation-trace-bridge',
        message: 'Trace bridge criado para recomendação institucional.',
      }),
      Object.freeze({
        eventId: `${input.recommendationId}:audit:explanation`,
        sessionId: input.sessionId,
        occurredAtEpochMs: input.occurredAtEpochMs + 2,
        type: 'EXPLANATION_CREATED',
        severity: input.decision === 'OBSERVAR' ? 'WARNING' : severity,
        source: 'institutional-recommendation-trace-bridge',
        message: 'Sinais de explicabilidade criados para recomendação.',
      }),
    ];
  }

  private createLedgerEvents(
    auditEvents: readonly RecommendationAuditEvent[],
  ): RecommendationLedgerEvent[] {
    return auditEvents.map((event) =>
      Object.freeze({
        eventId: event.eventId.replace(':audit:', ':ledger:'),
        sessionId: event.sessionId,
        occurredAtEpochMs: event.occurredAtEpochMs,
        type: event.type,
        severity: event.severity,
        source: event.source,
        message: event.message,
      }),
    );
  }

  private resolveStatus(
    input: RecommendationBridgeInput,
    reasons: readonly RecommendationBridgeReason[],
  ): RecommendationBridgeStatus {
    if (
      this.policy.productionMoneyAllowed ||
      this.policy.liveMoneyAuthorization ||
      reasons.includes('POLICY_LOCK_ACTIVE') ||
      input.defensiveBlock ||
      input.decision === 'NAO_UTILIZAR'
    ) {
      return 'BRIDGE_TRACE_BLOCKED';
    }

    if (
      input.institutionalScore >= this.policy.minimumTraceReadyScore &&
      input.learningScore >= this.policy.minimumTraceReviewScore
    ) {
      return 'BRIDGE_TRACE_READY';
    }

    return 'BRIDGE_TRACE_REVIEW';
  }

  private resolveReasons(input: RecommendationBridgeInput): RecommendationBridgeReason[] {
    const reasons: RecommendationBridgeReason[] = ['PAPER_ONLY_POLICY_LOCK'];

    if (this.policy.productionMoneyAllowed || this.policy.liveMoneyAuthorization) {
      reasons.push('POLICY_LOCK_ACTIVE');
    }

    if (input.decision === 'PAPER_FAVORAVEL') {
      reasons.push('RECOMMENDATION_READY');
    }

    if (input.decision === 'OBSERVAR') {
      reasons.push('RECOMMENDATION_OBSERVE');
    }

    if (input.decision === 'NAO_UTILIZAR') {
      reasons.push('RECOMMENDATION_BLOCKED');
    }

    if (input.defensiveBlock) {
      reasons.push('DEFENSIVE_BLOCK_ACTIVE');
    }

    reasons.push('TRACE_NODE_CREATED');
    reasons.push('EXPLANATION_SIGNAL_CREATED');
    reasons.push('AUDIT_EVENT_CREATED');
    reasons.push('LEDGER_EVENT_CREATED');

    return reasons;
  }

  private mapReasonCategory(
    reason: string,
  ): RecommendationExplanationSignal['category'] {
    if (reason.includes('RISK')) return 'RISK';
    if (reason.includes('OPERATOR')) return 'OPERATOR';
    if (reason.includes('LEARNING')) return 'LEARNING';
    if (reason.includes('POLICY')) return 'POLICY';
    return 'SYSTEM';
  }

  private reasonScore(reason: string, input: RecommendationBridgeInput): number {
    if (reason.includes('WEAK') || reason.includes('REJECTED')) {
      return round4(clamp01(1 - input.institutionalScore));
    }

    if (reason.includes('LEARNING')) {
      return input.learningScore;
    }

    return input.institutionalScore;
  }

  private validate(
    input: RecommendationBridgeInput,
  ): RecommendationTraceBridgeFailure | null {
    if (input.recommendationId.trim().length === 0) {
      return {
        code: 'INVALID_RECOMMENDATION_TRACE_BRIDGE_INPUT',
        message: 'recommendationId must not be empty',
      };
    }

    if (input.sessionId.trim().length === 0) {
      return {
        code: 'INVALID_RECOMMENDATION_TRACE_BRIDGE_INPUT',
        message: 'sessionId must not be empty',
      };
    }

    if (input.strategyId.trim().length === 0) {
      return {
        code: 'INVALID_RECOMMENDATION_TRACE_BRIDGE_INPUT',
        message: 'strategyId must not be empty',
      };
    }

    if (input.tableId.trim().length === 0) {
      return {
        code: 'INVALID_RECOMMENDATION_TRACE_BRIDGE_INPUT',
        message: 'tableId must not be empty',
      };
    }

    if (!Number.isFinite(input.occurredAtEpochMs) || input.occurredAtEpochMs < 0) {
      return {
        code: 'INVALID_RECOMMENDATION_TRACE_BRIDGE_INPUT',
        message: 'occurredAtEpochMs must be a valid non-negative timestamp',
      };
    }

    const scores = [input.institutionalScore, input.learningScore];

    if (scores.some((score) => score < 0 || score > 1 || !Number.isFinite(score))) {
      return {
        code: 'INVALID_RECOMMENDATION_TRACE_BRIDGE_INPUT',
        message: 'scores must be between 0 and 1',
      };
    }

    for (const reason of input.reasons) {
      if (reason.trim().length === 0) {
        return {
          code: 'INVALID_RECOMMENDATION_TRACE_BRIDGE_INPUT',
          message: 'reasons must not contain empty values',
        };
      }
    }

    return null;
  }
}
