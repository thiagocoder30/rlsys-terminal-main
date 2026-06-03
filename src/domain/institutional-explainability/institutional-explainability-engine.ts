export type InstitutionalDecisionStatus =
  | 'PAPER_FAVORAVEL'
  | 'OBSERVAR'
  | 'NAO_UTILIZAR';

export type InstitutionalExplanationSeverity =
  | 'INFO'
  | 'WARNING'
  | 'BLOCKER';

export type InstitutionalExplanationCategory =
  | 'POLICY'
  | 'CERTIFICATION'
  | 'READINESS'
  | 'CONSENSUS'
  | 'STRATEGY'
  | 'TABLE'
  | 'CONFIDENCE'
  | 'RISK'
  | 'OPERATOR'
  | 'MEMORY'
  | 'SYSTEM';

export interface InstitutionalExplanationSignal {
  readonly category: InstitutionalExplanationCategory;
  readonly severity: InstitutionalExplanationSeverity;
  readonly code: string;
  readonly message: string;
  readonly score: number;
}

export interface InstitutionalExplainabilityInput {
  readonly sessionId: string;
  readonly strategyId: string;
  readonly tableId: string;
  readonly decisionStatus: InstitutionalDecisionStatus;
  readonly calibratedConfidence: number;
  readonly institutionalScore: number;
  readonly signals: readonly InstitutionalExplanationSignal[];
}

export interface InstitutionalExplainabilityPolicy {
  readonly maximumOperatorMessages: number;
  readonly productionMoneyAllowed: boolean;
  readonly liveMoneyAuthorization: boolean;
}

export interface InstitutionalExplanationItem {
  readonly category: InstitutionalExplanationCategory;
  readonly severity: InstitutionalExplanationSeverity;
  readonly code: string;
  readonly message: string;
}

export interface InstitutionalExplainabilityReport {
  readonly sessionId: string;
  readonly strategyId: string;
  readonly tableId: string;
  readonly decisionStatus: InstitutionalDecisionStatus;
  readonly operatorSummary: string;
  readonly calibratedConfidence: number;
  readonly institutionalScore: number;
  readonly blockers: readonly InstitutionalExplanationItem[];
  readonly warnings: readonly InstitutionalExplanationItem[];
  readonly infos: readonly InstitutionalExplanationItem[];
  readonly productionMoneyAllowed: false;
  readonly liveMoneyAuthorization: false;
  readonly paperOnly: true;
}

export interface InstitutionalExplainabilityFailure {
  readonly code: 'INVALID_INSTITUTIONAL_EXPLAINABILITY_INPUT';
  readonly message: string;
}

export type InstitutionalExplainabilityResult =
  | {
      readonly ok: true;
      readonly value: InstitutionalExplainabilityReport;
    }
  | {
      readonly ok: false;
      readonly error: InstitutionalExplainabilityFailure;
    };

const DEFAULT_POLICY: InstitutionalExplainabilityPolicy = Object.freeze({
  maximumOperatorMessages: 6,
  productionMoneyAllowed: false,
  liveMoneyAuthorization: false,
});

const severityWeight = (
  severity: InstitutionalExplanationSeverity,
): number => {
  if (severity === 'BLOCKER') {
    return 3;
  }

  if (severity === 'WARNING') {
    return 2;
  }

  return 1;
};

const compareSignals = (
  left: InstitutionalExplanationSignal,
  right: InstitutionalExplanationSignal,
): number => {
  const severityDelta = severityWeight(right.severity) - severityWeight(left.severity);

  if (severityDelta !== 0) {
    return severityDelta;
  }

  const scoreDelta = right.score - left.score;

  if (scoreDelta !== 0) {
    return scoreDelta;
  }

  return left.code.localeCompare(right.code);
};

export class InstitutionalExplainabilityEngine {
  private readonly policy: InstitutionalExplainabilityPolicy;

  public constructor(policy: InstitutionalExplainabilityPolicy = DEFAULT_POLICY) {
    this.policy = Object.freeze({
      maximumOperatorMessages: policy.maximumOperatorMessages,
      productionMoneyAllowed: policy.productionMoneyAllowed,
      liveMoneyAuthorization: policy.liveMoneyAuthorization,
    });
  }

  /**
   * Builds an operator-facing explanation in O(n log n) due deterministic sorting.
   * The engine is pure, idempotent and never authorizes live money.
   */
  public explain(
    input: InstitutionalExplainabilityInput,
  ): InstitutionalExplainabilityResult {
    const validationFailure = this.validate(input);

    if (validationFailure !== null) {
      return {
        ok: false,
        error: validationFailure,
      };
    }

    const normalizedSignals = this.normalizeSignals(input.signals);
    const blockers = this.filterBySeverity(normalizedSignals, 'BLOCKER');
    const warnings = this.filterBySeverity(normalizedSignals, 'WARNING');
    const infos = this.filterBySeverity(normalizedSignals, 'INFO');
    const operatorSummary = this.composeSummary(input, blockers, warnings);

    return {
      ok: true,
      value: Object.freeze({
        sessionId: input.sessionId,
        strategyId: input.strategyId,
        tableId: input.tableId,
        decisionStatus: input.decisionStatus,
        operatorSummary,
        calibratedConfidence: input.calibratedConfidence,
        institutionalScore: input.institutionalScore,
        blockers: Object.freeze(blockers),
        warnings: Object.freeze(warnings),
        infos: Object.freeze(infos),
        productionMoneyAllowed: false,
        liveMoneyAuthorization: false,
        paperOnly: true,
      }),
    };
  }

  private normalizeSignals(
    signals: readonly InstitutionalExplanationSignal[],
  ): readonly InstitutionalExplanationItem[] {
    const sortedSignals = [...signals].sort(compareSignals);
    const items: InstitutionalExplanationItem[] = [];

    for (const signal of sortedSignals) {
      if (items.length >= this.policy.maximumOperatorMessages) {
        break;
      }

      items.push(
        Object.freeze({
          category: signal.category,
          severity: signal.severity,
          code: signal.code,
          message: signal.message,
        }),
      );
    }

    return Object.freeze(items);
  }

  private filterBySeverity(
    items: readonly InstitutionalExplanationItem[],
    severity: InstitutionalExplanationSeverity,
  ): readonly InstitutionalExplanationItem[] {
    return Object.freeze(items.filter((item) => item.severity === severity));
  }

  private composeSummary(
    input: InstitutionalExplainabilityInput,
    blockers: readonly InstitutionalExplanationItem[],
    warnings: readonly InstitutionalExplanationItem[],
  ): string {
    if (this.policy.productionMoneyAllowed || this.policy.liveMoneyAuthorization) {
      return 'NAO_UTILIZAR: política institucional bloqueia qualquer autorização de live money.';
    }

    if (input.decisionStatus === 'NAO_UTILIZAR') {
      if (blockers.length > 0) {
        return `NAO_UTILIZAR: ${blockers[0]?.message ?? 'bloqueio institucional ativo.'}`;
      }

      return 'NAO_UTILIZAR: alinhamento institucional insuficiente para contexto PAPER.';
    }

    if (input.decisionStatus === 'OBSERVAR') {
      if (warnings.length > 0) {
        return `OBSERVAR: ${warnings[0]?.message ?? 'evidência moderada requer observação.'}`;
      }

      return 'OBSERVAR: evidência institucional ainda insuficiente para PAPER_FAVORAVEL.';
    }

    return 'PAPER_FAVORAVEL: contexto institucional favorável apenas para avaliação PAPER supervisionada.';
  }

  private validate(
    input: InstitutionalExplainabilityInput,
  ): InstitutionalExplainabilityFailure | null {
    if (input.sessionId.trim().length === 0) {
      return {
        code: 'INVALID_INSTITUTIONAL_EXPLAINABILITY_INPUT',
        message: 'sessionId must not be empty',
      };
    }

    if (input.strategyId.trim().length === 0) {
      return {
        code: 'INVALID_INSTITUTIONAL_EXPLAINABILITY_INPUT',
        message: 'strategyId must not be empty',
      };
    }

    if (input.tableId.trim().length === 0) {
      return {
        code: 'INVALID_INSTITUTIONAL_EXPLAINABILITY_INPUT',
        message: 'tableId must not be empty',
      };
    }

    if (this.policy.maximumOperatorMessages <= 0) {
      return {
        code: 'INVALID_INSTITUTIONAL_EXPLAINABILITY_INPUT',
        message: 'maximumOperatorMessages must be greater than zero',
      };
    }

    const normalizedValues = [
      input.calibratedConfidence,
      input.institutionalScore,
    ];

    if (normalizedValues.some((value) => value < 0 || value > 1)) {
      return {
        code: 'INVALID_INSTITUTIONAL_EXPLAINABILITY_INPUT',
        message: 'normalized scores must be between 0 and 1',
      };
    }

    for (const signal of input.signals) {
      if (signal.code.trim().length === 0) {
        return {
          code: 'INVALID_INSTITUTIONAL_EXPLAINABILITY_INPUT',
          message: 'signal code must not be empty',
        };
      }

      if (signal.message.trim().length === 0) {
        return {
          code: 'INVALID_INSTITUTIONAL_EXPLAINABILITY_INPUT',
          message: 'signal message must not be empty',
        };
      }

      if (signal.score < 0 || signal.score > 1) {
        return {
          code: 'INVALID_INSTITUTIONAL_EXPLAINABILITY_INPUT',
          message: 'signal score must be between 0 and 1',
        };
      }
    }

    return null;
  }
}
