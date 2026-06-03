export type InstitutionalDecisionTraceStatus =
  | 'PAPER_FAVORAVEL'
  | 'OBSERVAR'
  | 'NAO_UTILIZAR';

export type InstitutionalDecisionTraceNodeStatus =
  | 'PASS'
  | 'WARN'
  | 'BLOCK';

export type InstitutionalDecisionTraceReason =
  | 'PAPER_ONLY_POLICY_LOCK'
  | 'TRACE_EMPTY'
  | 'TRACE_HAS_BLOCKERS'
  | 'TRACE_HAS_WARNINGS'
  | 'TRACE_ALIGNED'
  | 'INSUFFICIENT_TRACE_SCORE'
  | 'POLICY_LOCK_ACTIVE';

export interface InstitutionalDecisionTraceNode {
  readonly nodeId: string;
  readonly label: string;
  readonly status: InstitutionalDecisionTraceNodeStatus;
  readonly weight: number;
  readonly score: number;
  readonly message: string;
}

export interface InstitutionalDecisionTraceInput {
  readonly sessionId: string;
  readonly strategyId: string;
  readonly tableId: string;
  readonly requestedStatus: InstitutionalDecisionTraceStatus;
  readonly nodes: readonly InstitutionalDecisionTraceNode[];
}

export interface InstitutionalDecisionTracePolicy {
  readonly minimumPaperFavorableScore: number;
  readonly minimumObserveScore: number;
  readonly productionMoneyAllowed: boolean;
  readonly liveMoneyAuthorization: boolean;
}

export interface InstitutionalDecisionTraceStep {
  readonly order: number;
  readonly nodeId: string;
  readonly label: string;
  readonly status: InstitutionalDecisionTraceNodeStatus;
  readonly contribution: number;
  readonly message: string;
}

export interface InstitutionalDecisionTraceReport {
  readonly sessionId: string;
  readonly strategyId: string;
  readonly tableId: string;
  readonly requestedStatus: InstitutionalDecisionTraceStatus;
  readonly resolvedStatus: InstitutionalDecisionTraceStatus;
  readonly traceScore: number;
  readonly totalWeight: number;
  readonly steps: readonly InstitutionalDecisionTraceStep[];
  readonly reasons: readonly InstitutionalDecisionTraceReason[];
  readonly productionMoneyAllowed: false;
  readonly liveMoneyAuthorization: false;
  readonly paperOnly: true;
}

export interface InstitutionalDecisionTraceFailure {
  readonly code: 'INVALID_INSTITUTIONAL_DECISION_TRACE_INPUT';
  readonly message: string;
}

export type InstitutionalDecisionTraceResult =
  | {
      readonly ok: true;
      readonly value: InstitutionalDecisionTraceReport;
    }
  | {
      readonly ok: false;
      readonly error: InstitutionalDecisionTraceFailure;
    };

const DEFAULT_POLICY: InstitutionalDecisionTracePolicy = Object.freeze({
  minimumPaperFavorableScore: 0.72,
  minimumObserveScore: 0.48,
  productionMoneyAllowed: false,
  liveMoneyAuthorization: false,
});

const round4 = (value: number): number => Math.round(value * 10000) / 10000;

const statusPriority = (status: InstitutionalDecisionTraceNodeStatus): number => {
  if (status === 'BLOCK') {
    return 3;
  }

  if (status === 'WARN') {
    return 2;
  }

  return 1;
};

const compareNodes = (
  left: InstitutionalDecisionTraceNode,
  right: InstitutionalDecisionTraceNode,
): number => {
  const priorityDelta = statusPriority(right.status) - statusPriority(left.status);

  if (priorityDelta !== 0) {
    return priorityDelta;
  }

  const weightDelta = right.weight - left.weight;

  if (weightDelta !== 0) {
    return weightDelta;
  }

  return left.nodeId.localeCompare(right.nodeId);
};

export class InstitutionalDecisionTraceEngine {
  private readonly policy: InstitutionalDecisionTracePolicy;

  public constructor(policy: InstitutionalDecisionTracePolicy = DEFAULT_POLICY) {
    this.policy = Object.freeze({
      minimumPaperFavorableScore: policy.minimumPaperFavorableScore,
      minimumObserveScore: policy.minimumObserveScore,
      productionMoneyAllowed: policy.productionMoneyAllowed,
      liveMoneyAuthorization: policy.liveMoneyAuthorization,
    });
  }

  /**
   * Builds a deterministic institutional decision trace.
   * Complexity: O(n log n) due deterministic ordering, O(n) memory.
   */
  public trace(
    input: InstitutionalDecisionTraceInput,
  ): InstitutionalDecisionTraceResult {
    const validationFailure = this.validate(input);

    if (validationFailure !== null) {
      return {
        ok: false,
        error: validationFailure,
      };
    }

    const orderedNodes = [...input.nodes].sort(compareNodes);
    const totalWeight = this.calculateTotalWeight(orderedNodes);
    const traceScore = this.calculateTraceScore(orderedNodes, totalWeight);
    const steps = this.createSteps(orderedNodes);
    const reasons = this.resolveReasons(orderedNodes, traceScore);
    const resolvedStatus = this.resolveStatus(input, orderedNodes, traceScore);

    return {
      ok: true,
      value: Object.freeze({
        sessionId: input.sessionId,
        strategyId: input.strategyId,
        tableId: input.tableId,
        requestedStatus: input.requestedStatus,
        resolvedStatus,
        traceScore,
        totalWeight,
        steps: Object.freeze(steps),
        reasons: Object.freeze(reasons),
        productionMoneyAllowed: false,
        liveMoneyAuthorization: false,
        paperOnly: true,
      }),
    };
  }

  private calculateTotalWeight(
    nodes: readonly InstitutionalDecisionTraceNode[],
  ): number {
    let totalWeight = 0;

    for (const node of nodes) {
      totalWeight += node.weight;
    }

    return round4(totalWeight);
  }

  private calculateTraceScore(
    nodes: readonly InstitutionalDecisionTraceNode[],
    totalWeight: number,
  ): number {
    if (nodes.length === 0 || totalWeight <= 0) {
      return 0;
    }

    let weightedScore = 0;

    for (const node of nodes) {
      const statusMultiplier = this.statusMultiplier(node.status);
      weightedScore += node.score * node.weight * statusMultiplier;
    }

    return round4(weightedScore / totalWeight);
  }

  private statusMultiplier(status: InstitutionalDecisionTraceNodeStatus): number {
    if (status === 'BLOCK') {
      return 0;
    }

    if (status === 'WARN') {
      return 0.5;
    }

    return 1;
  }

  private createSteps(
    nodes: readonly InstitutionalDecisionTraceNode[],
  ): InstitutionalDecisionTraceStep[] {
    const steps: InstitutionalDecisionTraceStep[] = [];

    for (let index = 0; index < nodes.length; index += 1) {
      const node = nodes[index];

      if (node === undefined) {
        continue;
      }

      steps.push(
        Object.freeze({
          order: index + 1,
          nodeId: node.nodeId,
          label: node.label,
          status: node.status,
          contribution: round4(node.score * node.weight * this.statusMultiplier(node.status)),
          message: node.message,
        }),
      );
    }

    return steps;
  }

  private resolveReasons(
    nodes: readonly InstitutionalDecisionTraceNode[],
    traceScore: number,
  ): InstitutionalDecisionTraceReason[] {
    const reasons: InstitutionalDecisionTraceReason[] = ['PAPER_ONLY_POLICY_LOCK'];

    if (this.policy.productionMoneyAllowed || this.policy.liveMoneyAuthorization) {
      reasons.push('POLICY_LOCK_ACTIVE');
    }

    if (nodes.length === 0) {
      reasons.push('TRACE_EMPTY');
      return reasons;
    }

    if (nodes.some((node) => node.status === 'BLOCK')) {
      reasons.push('TRACE_HAS_BLOCKERS');
    }

    if (nodes.some((node) => node.status === 'WARN')) {
      reasons.push('TRACE_HAS_WARNINGS');
    }

    if (traceScore >= this.policy.minimumPaperFavorableScore) {
      reasons.push('TRACE_ALIGNED');
    }

    if (traceScore < this.policy.minimumObserveScore) {
      reasons.push('INSUFFICIENT_TRACE_SCORE');
    }

    return reasons;
  }

  private resolveStatus(
    input: InstitutionalDecisionTraceInput,
    nodes: readonly InstitutionalDecisionTraceNode[],
    traceScore: number,
  ): InstitutionalDecisionTraceStatus {
    if (this.policy.productionMoneyAllowed || this.policy.liveMoneyAuthorization) {
      return 'NAO_UTILIZAR';
    }

    if (nodes.length === 0) {
      return 'NAO_UTILIZAR';
    }

    if (nodes.some((node) => node.status === 'BLOCK')) {
      return 'NAO_UTILIZAR';
    }

    if (traceScore >= this.policy.minimumPaperFavorableScore) {
      return input.requestedStatus === 'PAPER_FAVORAVEL'
        ? 'PAPER_FAVORAVEL'
        : input.requestedStatus;
    }

    if (traceScore >= this.policy.minimumObserveScore) {
      return 'OBSERVAR';
    }

    return 'NAO_UTILIZAR';
  }

  private validate(
    input: InstitutionalDecisionTraceInput,
  ): InstitutionalDecisionTraceFailure | null {
    if (input.sessionId.trim().length === 0) {
      return {
        code: 'INVALID_INSTITUTIONAL_DECISION_TRACE_INPUT',
        message: 'sessionId must not be empty',
      };
    }

    if (input.strategyId.trim().length === 0) {
      return {
        code: 'INVALID_INSTITUTIONAL_DECISION_TRACE_INPUT',
        message: 'strategyId must not be empty',
      };
    }

    if (input.tableId.trim().length === 0) {
      return {
        code: 'INVALID_INSTITUTIONAL_DECISION_TRACE_INPUT',
        message: 'tableId must not be empty',
      };
    }

    for (const node of input.nodes) {
      if (node.nodeId.trim().length === 0) {
        return {
          code: 'INVALID_INSTITUTIONAL_DECISION_TRACE_INPUT',
          message: 'nodeId must not be empty',
        };
      }

      if (node.label.trim().length === 0) {
        return {
          code: 'INVALID_INSTITUTIONAL_DECISION_TRACE_INPUT',
          message: 'label must not be empty',
        };
      }

      if (node.message.trim().length === 0) {
        return {
          code: 'INVALID_INSTITUTIONAL_DECISION_TRACE_INPUT',
          message: 'message must not be empty',
        };
      }

      if (node.weight <= 0 || !Number.isFinite(node.weight)) {
        return {
          code: 'INVALID_INSTITUTIONAL_DECISION_TRACE_INPUT',
          message: 'weight must be greater than zero',
        };
      }

      if (node.score < 0 || node.score > 1 || !Number.isFinite(node.score)) {
        return {
          code: 'INVALID_INSTITUTIONAL_DECISION_TRACE_INPUT',
          message: 'score must be between 0 and 1',
        };
      }
    }

    return null;
  }
}
