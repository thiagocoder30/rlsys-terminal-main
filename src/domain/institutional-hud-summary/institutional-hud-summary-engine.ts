export type InstitutionalHudStatus =
  | 'PAPER_FAVORAVEL'
  | 'OBSERVAR'
  | 'NAO_UTILIZAR';

export type InstitutionalHudModuleStatus =
  | 'ENABLED'
  | 'DISABLED'
  | 'DEGRADED'
  | 'BLOCKED';

export type InstitutionalHudReason =
  | 'PAPER_ONLY_POLICY_LOCK'
  | 'CERTIFICATION_READY'
  | 'CERTIFICATION_BLOCKED'
  | 'READINESS_READY'
  | 'READINESS_BLOCKED'
  | 'CONSENSUS_READY'
  | 'CONSENSUS_BLOCKED'
  | 'STRATEGY_REPUTATION_READY'
  | 'STRATEGY_REPUTATION_BLOCKED'
  | 'TABLE_REPUTATION_READY'
  | 'TABLE_REPUTATION_BLOCKED'
  | 'ADAPTIVE_CONFIDENCE_READY'
  | 'ADAPTIVE_CONFIDENCE_BLOCKED'
  | 'MULTI_SESSION_READY'
  | 'MULTI_SESSION_BLOCKED'
  | 'OPERATOR_READY'
  | 'OPERATOR_BLOCKED'
  | 'RISK_READY'
  | 'RISK_BLOCKED'
  | 'INSUFFICIENT_INSTITUTIONAL_ALIGNMENT';

export interface InstitutionalHudModuleSnapshot {
  readonly name: string;
  readonly status: InstitutionalHudModuleStatus;
  readonly score: number;
}

export interface InstitutionalHudSummaryInput {
  readonly sessionId: string;
  readonly strategyId: string;
  readonly tableId: string;
  readonly certificationStatus: InstitutionalHudModuleStatus;
  readonly readinessStatus: InstitutionalHudModuleStatus;
  readonly consensusStatus: InstitutionalHudModuleStatus;
  readonly strategyReputationStatus: InstitutionalHudModuleStatus;
  readonly tableReputationStatus: InstitutionalHudModuleStatus;
  readonly adaptiveConfidenceStatus: InstitutionalHudModuleStatus;
  readonly multiSessionAnalyticsStatus: InstitutionalHudModuleStatus;
  readonly operatorStatus: InstitutionalHudModuleStatus;
  readonly riskStatus: InstitutionalHudModuleStatus;
  readonly calibratedConfidence: number;
  readonly institutionalScore: number;
}

export interface InstitutionalHudSummaryPolicy {
  readonly minimumPaperFavorableScore: number;
  readonly minimumObserveScore: number;
  readonly minimumPaperFavorableConfidence: number;
  readonly minimumObserveConfidence: number;
  readonly productionMoneyAllowed: boolean;
  readonly liveMoneyAuthorization: boolean;
}

export interface InstitutionalHudSummaryReport {
  readonly sessionId: string;
  readonly strategyId: string;
  readonly tableId: string;
  readonly status: InstitutionalHudStatus;
  readonly calibratedConfidence: number;
  readonly institutionalScore: number;
  readonly modules: readonly InstitutionalHudModuleSnapshot[];
  readonly reasons: readonly InstitutionalHudReason[];
  readonly productionMoneyAllowed: false;
  readonly liveMoneyAuthorization: false;
  readonly paperOnly: true;
}

export interface InstitutionalHudSummaryFailure {
  readonly code: 'INVALID_INSTITUTIONAL_HUD_INPUT';
  readonly message: string;
}

export type InstitutionalHudSummaryResult =
  | {
      readonly ok: true;
      readonly value: InstitutionalHudSummaryReport;
    }
  | {
      readonly ok: false;
      readonly error: InstitutionalHudSummaryFailure;
    };

const DEFAULT_POLICY: InstitutionalHudSummaryPolicy = Object.freeze({
  minimumPaperFavorableScore: 0.72,
  minimumObserveScore: 0.48,
  minimumPaperFavorableConfidence: 0.72,
  minimumObserveConfidence: 0.48,
  productionMoneyAllowed: false,
  liveMoneyAuthorization: false,
});

const isHealthyStatus = (status: InstitutionalHudModuleStatus): boolean =>
  status === 'ENABLED';

const isBlockedStatus = (status: InstitutionalHudModuleStatus): boolean =>
  status === 'BLOCKED' || status === 'DISABLED';

const moduleScore = (status: InstitutionalHudModuleStatus): number => {
  if (status === 'ENABLED') {
    return 1;
  }

  if (status === 'DEGRADED') {
    return 0.5;
  }

  return 0;
};

export class InstitutionalHudSummaryEngine {
  private readonly policy: InstitutionalHudSummaryPolicy;

  public constructor(policy: InstitutionalHudSummaryPolicy = DEFAULT_POLICY) {
    this.policy = Object.freeze({
      minimumPaperFavorableScore: policy.minimumPaperFavorableScore,
      minimumObserveScore: policy.minimumObserveScore,
      minimumPaperFavorableConfidence: policy.minimumPaperFavorableConfidence,
      minimumObserveConfidence: policy.minimumObserveConfidence,
      productionMoneyAllowed: policy.productionMoneyAllowed,
      liveMoneyAuthorization: policy.liveMoneyAuthorization,
    });
  }

  /**
   * Creates a terminal-first institutional HUD summary in O(1).
   * This engine is stateless, idempotent and paper-only.
   */
  public summarize(
    input: InstitutionalHudSummaryInput,
  ): InstitutionalHudSummaryResult {
    const validationFailure = this.validate(input);

    if (validationFailure !== null) {
      return {
        ok: false,
        error: validationFailure,
      };
    }

    const modules = this.createModules(input);
    const reasons = this.resolveReasons(input);
    const status = this.resolveStatus(input, reasons);

    return {
      ok: true,
      value: Object.freeze({
        sessionId: input.sessionId,
        strategyId: input.strategyId,
        tableId: input.tableId,
        status,
        calibratedConfidence: input.calibratedConfidence,
        institutionalScore: input.institutionalScore,
        modules: Object.freeze(modules),
        reasons: Object.freeze(reasons),
        productionMoneyAllowed: false,
        liveMoneyAuthorization: false,
        paperOnly: true,
      }),
    };
  }

  private createModules(
    input: InstitutionalHudSummaryInput,
  ): readonly InstitutionalHudModuleSnapshot[] {
    return Object.freeze([
      Object.freeze({
        name: 'certification',
        status: input.certificationStatus,
        score: moduleScore(input.certificationStatus),
      }),
      Object.freeze({
        name: 'readiness',
        status: input.readinessStatus,
        score: moduleScore(input.readinessStatus),
      }),
      Object.freeze({
        name: 'consensus',
        status: input.consensusStatus,
        score: moduleScore(input.consensusStatus),
      }),
      Object.freeze({
        name: 'strategyReputation',
        status: input.strategyReputationStatus,
        score: moduleScore(input.strategyReputationStatus),
      }),
      Object.freeze({
        name: 'tableReputation',
        status: input.tableReputationStatus,
        score: moduleScore(input.tableReputationStatus),
      }),
      Object.freeze({
        name: 'adaptiveConfidence',
        status: input.adaptiveConfidenceStatus,
        score: moduleScore(input.adaptiveConfidenceStatus),
      }),
      Object.freeze({
        name: 'multiSessionAnalytics',
        status: input.multiSessionAnalyticsStatus,
        score: moduleScore(input.multiSessionAnalyticsStatus),
      }),
      Object.freeze({
        name: 'operator',
        status: input.operatorStatus,
        score: moduleScore(input.operatorStatus),
      }),
      Object.freeze({
        name: 'risk',
        status: input.riskStatus,
        score: moduleScore(input.riskStatus),
      }),
    ]);
  }

  private resolveStatus(
    input: InstitutionalHudSummaryInput,
    reasons: readonly InstitutionalHudReason[],
  ): InstitutionalHudStatus {
    if (this.policy.productionMoneyAllowed || this.policy.liveMoneyAuthorization) {
      return 'NAO_UTILIZAR';
    }

    if (
      reasons.includes('CERTIFICATION_BLOCKED') ||
      reasons.includes('READINESS_BLOCKED') ||
      reasons.includes('CONSENSUS_BLOCKED') ||
      reasons.includes('STRATEGY_REPUTATION_BLOCKED') ||
      reasons.includes('TABLE_REPUTATION_BLOCKED') ||
      reasons.includes('ADAPTIVE_CONFIDENCE_BLOCKED') ||
      reasons.includes('MULTI_SESSION_BLOCKED') ||
      reasons.includes('OPERATOR_BLOCKED') ||
      reasons.includes('RISK_BLOCKED')
    ) {
      return 'NAO_UTILIZAR';
    }

    if (
      input.institutionalScore >= this.policy.minimumPaperFavorableScore &&
      input.calibratedConfidence >= this.policy.minimumPaperFavorableConfidence
    ) {
      return 'PAPER_FAVORAVEL';
    }

    if (
      input.institutionalScore >= this.policy.minimumObserveScore &&
      input.calibratedConfidence >= this.policy.minimumObserveConfidence
    ) {
      return 'OBSERVAR';
    }

    return 'NAO_UTILIZAR';
  }

  private resolveReasons(
    input: InstitutionalHudSummaryInput,
  ): InstitutionalHudReason[] {
    const reasons: InstitutionalHudReason[] = ['PAPER_ONLY_POLICY_LOCK'];

    this.pushReasonByStatus(
      reasons,
      input.certificationStatus,
      'CERTIFICATION_READY',
      'CERTIFICATION_BLOCKED',
    );
    this.pushReasonByStatus(
      reasons,
      input.readinessStatus,
      'READINESS_READY',
      'READINESS_BLOCKED',
    );
    this.pushReasonByStatus(
      reasons,
      input.consensusStatus,
      'CONSENSUS_READY',
      'CONSENSUS_BLOCKED',
    );
    this.pushReasonByStatus(
      reasons,
      input.strategyReputationStatus,
      'STRATEGY_REPUTATION_READY',
      'STRATEGY_REPUTATION_BLOCKED',
    );
    this.pushReasonByStatus(
      reasons,
      input.tableReputationStatus,
      'TABLE_REPUTATION_READY',
      'TABLE_REPUTATION_BLOCKED',
    );
    this.pushReasonByStatus(
      reasons,
      input.adaptiveConfidenceStatus,
      'ADAPTIVE_CONFIDENCE_READY',
      'ADAPTIVE_CONFIDENCE_BLOCKED',
    );
    this.pushReasonByStatus(
      reasons,
      input.multiSessionAnalyticsStatus,
      'MULTI_SESSION_READY',
      'MULTI_SESSION_BLOCKED',
    );
    this.pushReasonByStatus(
      reasons,
      input.operatorStatus,
      'OPERATOR_READY',
      'OPERATOR_BLOCKED',
    );
    this.pushReasonByStatus(
      reasons,
      input.riskStatus,
      'RISK_READY',
      'RISK_BLOCKED',
    );

    if (
      input.institutionalScore < this.policy.minimumObserveScore ||
      input.calibratedConfidence < this.policy.minimumObserveConfidence
    ) {
      reasons.push('INSUFFICIENT_INSTITUTIONAL_ALIGNMENT');
    }

    return reasons;
  }

  private pushReasonByStatus(
    reasons: InstitutionalHudReason[],
    status: InstitutionalHudModuleStatus,
    readyReason: InstitutionalHudReason,
    blockedReason: InstitutionalHudReason,
  ): void {
    if (isHealthyStatus(status)) {
      reasons.push(readyReason);
      return;
    }

    if (isBlockedStatus(status)) {
      reasons.push(blockedReason);
    }
  }

  private validate(
    input: InstitutionalHudSummaryInput,
  ): InstitutionalHudSummaryFailure | null {
    if (input.sessionId.trim().length === 0) {
      return {
        code: 'INVALID_INSTITUTIONAL_HUD_INPUT',
        message: 'sessionId must not be empty',
      };
    }

    if (input.strategyId.trim().length === 0) {
      return {
        code: 'INVALID_INSTITUTIONAL_HUD_INPUT',
        message: 'strategyId must not be empty',
      };
    }

    if (input.tableId.trim().length === 0) {
      return {
        code: 'INVALID_INSTITUTIONAL_HUD_INPUT',
        message: 'tableId must not be empty',
      };
    }

    const normalizedValues = [
      input.calibratedConfidence,
      input.institutionalScore,
    ];

    if (normalizedValues.some((value) => value < 0 || value > 1)) {
      return {
        code: 'INVALID_INSTITUTIONAL_HUD_INPUT',
        message: 'normalized values must be between 0 and 1',
      };
    }

    return null;
  }
}
