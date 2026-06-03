export type InstitutionalReadinessV2Status =
  | 'PAPER_READY'
  | 'NEEDS_REVIEW'
  | 'BLOCKED';

export type InstitutionalReadinessV2ModuleStatus =
  | 'ENABLED'
  | 'DEGRADED'
  | 'BLOCKED';

export type InstitutionalReadinessV2Reason =
  | 'PAPER_ONLY_POLICY_LOCK'
  | 'CORE_GOVERNANCE_READY'
  | 'PAPER_RUNTIME_READY'
  | 'LEARNING_LAYER_READY'
  | 'RECOMMENDATION_LAYER_READY'
  | 'TRACEABILITY_LAYER_READY'
  | 'AUDIT_LAYER_READY'
  | 'LOW_READINESS_SCORE'
  | 'MODULE_DEGRADED'
  | 'MODULE_BLOCKED'
  | 'DEFENSIVE_REVIEW_REQUIRED'
  | 'DEFENSIVE_BLOCK_ACTIVE'
  | 'POLICY_LOCK_ACTIVE';

export interface InstitutionalReadinessV2Module {
  readonly moduleName: string;
  readonly status: InstitutionalReadinessV2ModuleStatus;
  readonly score: number;
  readonly critical: boolean;
}

export interface InstitutionalReadinessReviewV2Input {
  readonly reviewId: string;
  readonly generatedAtEpochMs: number;
  readonly modules: readonly InstitutionalReadinessV2Module[];
}

export interface InstitutionalReadinessReviewV2Policy {
  readonly minimumPaperReadyScore: number;
  readonly minimumReviewScore: number;
  readonly maximumDegradedCriticalModules: number;
  readonly productionMoneyAllowed: boolean;
  readonly liveMoneyAuthorization: boolean;
}

export interface InstitutionalReadinessReviewV2Report {
  readonly reviewId: string;
  readonly status: InstitutionalReadinessV2Status;
  readonly readinessScore: number;
  readonly moduleCount: number;
  readonly enabledCount: number;
  readonly degradedCount: number;
  readonly blockedCount: number;
  readonly criticalDegradedCount: number;
  readonly criticalBlockedCount: number;
  readonly reasons: readonly InstitutionalReadinessV2Reason[];
  readonly productionMoneyAllowed: false;
  readonly liveMoneyAuthorization: false;
  readonly paperOnly: true;
}

export interface InstitutionalReadinessReviewV2Failure {
  readonly code: 'INVALID_INSTITUTIONAL_READINESS_REVIEW_V2_INPUT';
  readonly message: string;
}

export type InstitutionalReadinessReviewV2Result =
  | {
      readonly ok: true;
      readonly value: InstitutionalReadinessReviewV2Report;
    }
  | {
      readonly ok: false;
      readonly error: InstitutionalReadinessReviewV2Failure;
    };

interface ReadinessCounters {
  readonly enabledCount: number;
  readonly degradedCount: number;
  readonly blockedCount: number;
  readonly criticalDegradedCount: number;
  readonly criticalBlockedCount: number;
}

const DEFAULT_POLICY: InstitutionalReadinessReviewV2Policy = Object.freeze({
  minimumPaperReadyScore: 0.82,
  minimumReviewScore: 0.58,
  maximumDegradedCriticalModules: 1,
  productionMoneyAllowed: false,
  liveMoneyAuthorization: false,
});

const round4 = (value: number): number => Math.round(value * 10000) / 10000;

const safeRatio = (numerator: number, denominator: number): number => {
  if (denominator <= 0) {
    return 0;
  }

  return numerator / denominator;
};

export class InstitutionalReadinessReviewV2 {
  private readonly policy: InstitutionalReadinessReviewV2Policy;

  public constructor(policy: InstitutionalReadinessReviewV2Policy = DEFAULT_POLICY) {
    this.policy = Object.freeze({
      minimumPaperReadyScore: policy.minimumPaperReadyScore,
      minimumReviewScore: policy.minimumReviewScore,
      maximumDegradedCriticalModules: policy.maximumDegradedCriticalModules,
      productionMoneyAllowed: policy.productionMoneyAllowed,
      liveMoneyAuthorization: policy.liveMoneyAuthorization,
    });
  }

  /**
   * Reviews institutional PAPER readiness across all critical layers.
   * Complexity: O(n). This review never authorizes live money or automatic execution.
   */
  public review(
    input: InstitutionalReadinessReviewV2Input,
  ): InstitutionalReadinessReviewV2Result {
    const validationFailure = this.validate(input);

    if (validationFailure !== null) {
      return {
        ok: false,
        error: validationFailure,
      };
    }

    const counters = this.countModules(input.modules);
    const readinessScore = this.calculateReadinessScore(input.modules, counters);
    const reasons = this.resolveReasons(input.modules, counters, readinessScore);
    const status = this.resolveStatus(counters, readinessScore);

    return {
      ok: true,
      value: Object.freeze({
        reviewId: input.reviewId,
        status,
        readinessScore,
        moduleCount: input.modules.length,
        enabledCount: counters.enabledCount,
        degradedCount: counters.degradedCount,
        blockedCount: counters.blockedCount,
        criticalDegradedCount: counters.criticalDegradedCount,
        criticalBlockedCount: counters.criticalBlockedCount,
        reasons: Object.freeze(reasons),
        productionMoneyAllowed: false,
        liveMoneyAuthorization: false,
        paperOnly: true,
      }),
    };
  }

  private countModules(
    modules: readonly InstitutionalReadinessV2Module[],
  ): ReadinessCounters {
    let enabledCount = 0;
    let degradedCount = 0;
    let blockedCount = 0;
    let criticalDegradedCount = 0;
    let criticalBlockedCount = 0;

    for (const module of modules) {
      if (module.status === 'ENABLED') {
        enabledCount += 1;
      }

      if (module.status === 'DEGRADED') {
        degradedCount += 1;

        if (module.critical) {
          criticalDegradedCount += 1;
        }
      }

      if (module.status === 'BLOCKED') {
        blockedCount += 1;

        if (module.critical) {
          criticalBlockedCount += 1;
        }
      }
    }

    return {
      enabledCount,
      degradedCount,
      blockedCount,
      criticalDegradedCount,
      criticalBlockedCount,
    };
  }

  private calculateReadinessScore(
    modules: readonly InstitutionalReadinessV2Module[],
    counters: ReadinessCounters,
  ): number {
    if (modules.length === 0) {
      return 0;
    }

    let weightedScoreSum = 0;
    let weightSum = 0;

    for (const module of modules) {
      const weight = module.critical ? 1.5 : 1;
      const statusMultiplier =
        module.status === 'ENABLED' ? 1 : module.status === 'DEGRADED' ? 0.55 : 0;

      weightedScoreSum += module.score * statusMultiplier * weight;
      weightSum += weight;
    }

    const blockedPenalty = safeRatio(counters.blockedCount, modules.length) * 0.22;
    const criticalBlockedPenalty =
      safeRatio(counters.criticalBlockedCount, modules.length) * 0.35;

    return round4(
      Math.max(
        0,
        Math.min(1, safeRatio(weightedScoreSum, weightSum) - blockedPenalty - criticalBlockedPenalty),
      ),
    );
  }

  private resolveStatus(
    counters: ReadinessCounters,
    readinessScore: number,
  ): InstitutionalReadinessV2Status {
    if (this.policy.productionMoneyAllowed || this.policy.liveMoneyAuthorization) {
      return 'BLOCKED';
    }

    if (counters.criticalBlockedCount > 0 || counters.blockedCount > 0) {
      return 'BLOCKED';
    }

    if (
      counters.criticalDegradedCount > this.policy.maximumDegradedCriticalModules
    ) {
      return 'NEEDS_REVIEW';
    }

    if (readinessScore >= this.policy.minimumPaperReadyScore) {
      return 'PAPER_READY';
    }

    if (readinessScore >= this.policy.minimumReviewScore) {
      return 'NEEDS_REVIEW';
    }

    return 'BLOCKED';
  }

  private resolveReasons(
    modules: readonly InstitutionalReadinessV2Module[],
    counters: ReadinessCounters,
    readinessScore: number,
  ): InstitutionalReadinessV2Reason[] {
    const reasons: InstitutionalReadinessV2Reason[] = ['PAPER_ONLY_POLICY_LOCK'];

    if (this.policy.productionMoneyAllowed || this.policy.liveMoneyAuthorization) {
      reasons.push('POLICY_LOCK_ACTIVE');
    }

    if (this.hasEnabledModule(modules, 'Governance')) {
      reasons.push('CORE_GOVERNANCE_READY');
    }

    if (this.hasEnabledModule(modules, 'PaperRuntime')) {
      reasons.push('PAPER_RUNTIME_READY');
    }

    if (this.hasEnabledModule(modules, 'LearningLayer')) {
      reasons.push('LEARNING_LAYER_READY');
    }

    if (this.hasEnabledModule(modules, 'RecommendationLayer')) {
      reasons.push('RECOMMENDATION_LAYER_READY');
    }

    if (this.hasEnabledModule(modules, 'TraceabilityLayer')) {
      reasons.push('TRACEABILITY_LAYER_READY');
    }

    if (this.hasEnabledModule(modules, 'AuditLayer')) {
      reasons.push('AUDIT_LAYER_READY');
    }

    if (counters.degradedCount > 0) {
      reasons.push('MODULE_DEGRADED');
    }

    if (counters.blockedCount > 0) {
      reasons.push('MODULE_BLOCKED');
    }

    if (
      counters.criticalDegradedCount > this.policy.maximumDegradedCriticalModules ||
      readinessScore < this.policy.minimumPaperReadyScore
    ) {
      reasons.push('DEFENSIVE_REVIEW_REQUIRED');
    }

    if (
      counters.criticalBlockedCount > 0 ||
      counters.blockedCount > 0 ||
      this.policy.productionMoneyAllowed ||
      this.policy.liveMoneyAuthorization
    ) {
      reasons.push('DEFENSIVE_BLOCK_ACTIVE');
    }

    if (readinessScore < this.policy.minimumReviewScore) {
      reasons.push('LOW_READINESS_SCORE');
    }

    return reasons;
  }

  private hasEnabledModule(
    modules: readonly InstitutionalReadinessV2Module[],
    moduleName: string,
  ): boolean {
    return modules.some(
      (module) => module.moduleName === moduleName && module.status === 'ENABLED',
    );
  }

  private validate(
    input: InstitutionalReadinessReviewV2Input,
  ): InstitutionalReadinessReviewV2Failure | null {
    if (input.reviewId.trim().length === 0) {
      return {
        code: 'INVALID_INSTITUTIONAL_READINESS_REVIEW_V2_INPUT',
        message: 'reviewId must not be empty',
      };
    }

    if (!Number.isFinite(input.generatedAtEpochMs) || input.generatedAtEpochMs < 0) {
      return {
        code: 'INVALID_INSTITUTIONAL_READINESS_REVIEW_V2_INPUT',
        message: 'generatedAtEpochMs must be a valid non-negative timestamp',
      };
    }

    if (this.policy.maximumDegradedCriticalModules < 0) {
      return {
        code: 'INVALID_INSTITUTIONAL_READINESS_REVIEW_V2_INPUT',
        message: 'maximumDegradedCriticalModules must not be negative',
      };
    }

    const moduleNames = new Set<string>();

    for (const module of input.modules) {
      if (module.moduleName.trim().length === 0) {
        return {
          code: 'INVALID_INSTITUTIONAL_READINESS_REVIEW_V2_INPUT',
          message: 'moduleName must not be empty',
        };
      }

      if (moduleNames.has(module.moduleName)) {
        return {
          code: 'INVALID_INSTITUTIONAL_READINESS_REVIEW_V2_INPUT',
          message: 'duplicate moduleName detected',
        };
      }

      moduleNames.add(module.moduleName);

      if (module.score < 0 || module.score > 1 || !Number.isFinite(module.score)) {
        return {
          code: 'INVALID_INSTITUTIONAL_READINESS_REVIEW_V2_INPUT',
          message: 'module score must be between 0 and 1',
        };
      }
    }

    return null;
  }
}
