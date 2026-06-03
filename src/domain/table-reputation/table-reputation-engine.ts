export type TableReputationStatus =
  | 'STABLE_PAPER'
  | 'NEUTRAL_PAPER'
  | 'DEGRADED_PAPER'
  | 'BLOCKED_PAPER';

export type TableReputationReason =
  | 'PAPER_ONLY_POLICY_LOCK'
  | 'NO_HISTORY'
  | 'LOW_SAMPLE_SIZE'
  | 'STABLE_CONTEXT'
  | 'UNSTABLE_CONTEXT'
  | 'EXCESSIVE_VOLATILITY'
  | 'EXCESSIVE_BLOCK_RATE'
  | 'EXCESSIVE_DRAWDOWN'
  | 'INSUFFICIENT_CONFIDENCE'
  | 'CERTIFICATION_RISK'
  | 'OPERATOR_RISK';

export interface TableReputationSample {
  readonly tableId: string;
  readonly sessionId: string;
  readonly observedRounds: number;
  readonly paperSignals: number;
  readonly blockedSignals: number;
  readonly favorableSignals: number;
  readonly volatilityScore: number;
  readonly consensusScore: number;
  readonly confidenceScore: number;
  readonly maxDrawdownUnits: number;
  readonly certificationFailureCount: number;
  readonly operatorViolationCount: number;
}

export interface TableReputationPolicy {
  readonly minimumSamples: number;
  readonly minimumObservedRounds: number;
  readonly minimumStableScore: number;
  readonly minimumNeutralScore: number;
  readonly maximumVolatilityScore: number;
  readonly maximumBlockRate: number;
  readonly maximumDrawdownUnits: number;
  readonly maximumCertificationFailures: number;
  readonly maximumOperatorViolations: number;
  readonly productionMoneyAllowed: boolean;
  readonly liveMoneyAuthorization: boolean;
}

export interface TableReputationReport {
  readonly tableId: string;
  readonly status: TableReputationStatus;
  readonly reputationScore: number;
  readonly sampleCount: number;
  readonly observedRounds: number;
  readonly paperSignals: number;
  readonly blockRate: number;
  readonly favorableRate: number;
  readonly averageVolatilityScore: number;
  readonly averageConsensusScore: number;
  readonly averageConfidenceScore: number;
  readonly maxDrawdownUnits: number;
  readonly reasons: readonly TableReputationReason[];
  readonly productionMoneyAllowed: false;
  readonly liveMoneyAuthorization: false;
  readonly paperOnly: true;
}

export interface TableReputationFailure {
  readonly code: 'INVALID_TABLE_REPUTATION_INPUT';
  readonly message: string;
}

export type TableReputationResult =
  | {
      readonly ok: true;
      readonly value: readonly TableReputationReport[];
    }
  | {
      readonly ok: false;
      readonly error: TableReputationFailure;
    };

interface TableAccumulator {
  tableId: string;
  sampleCount: number;
  observedRounds: number;
  paperSignals: number;
  blockedSignals: number;
  favorableSignals: number;
  volatilityScoreSum: number;
  consensusScoreSum: number;
  confidenceScoreSum: number;
  maxDrawdownUnits: number;
  certificationFailureCount: number;
  operatorViolationCount: number;
}

const DEFAULT_POLICY: TableReputationPolicy = Object.freeze({
  minimumSamples: 3,
  minimumObservedRounds: 150,
  minimumStableScore: 0.72,
  minimumNeutralScore: 0.48,
  maximumVolatilityScore: 0.72,
  maximumBlockRate: 0.45,
  maximumDrawdownUnits: 8,
  maximumCertificationFailures: 0,
  maximumOperatorViolations: 0,
  productionMoneyAllowed: false,
  liveMoneyAuthorization: false,
});

const clamp01 = (value: number): number => {
  if (value < 0) {
    return 0;
  }

  if (value > 1) {
    return 1;
  }

  return value;
};

const safeRatio = (numerator: number, denominator: number): number => {
  if (denominator <= 0) {
    return 0;
  }

  return numerator / denominator;
};

export class TableReputationEngine {
  private readonly policy: TableReputationPolicy;

  public constructor(policy: TableReputationPolicy = DEFAULT_POLICY) {
    this.policy = Object.freeze({
      minimumSamples: policy.minimumSamples,
      minimumObservedRounds: policy.minimumObservedRounds,
      minimumStableScore: policy.minimumStableScore,
      minimumNeutralScore: policy.minimumNeutralScore,
      maximumVolatilityScore: policy.maximumVolatilityScore,
      maximumBlockRate: policy.maximumBlockRate,
      maximumDrawdownUnits: policy.maximumDrawdownUnits,
      maximumCertificationFailures: policy.maximumCertificationFailures,
      maximumOperatorViolations: policy.maximumOperatorViolations,
      productionMoneyAllowed: policy.productionMoneyAllowed,
      liveMoneyAuthorization: policy.liveMoneyAuthorization,
    });
  }

  /**
   * Aggregates table/session evidence in O(n) time and O(k) space,
   * where n is the number of samples and k is the number of tables.
   */
  public evaluate(
    samples: readonly TableReputationSample[],
  ): TableReputationResult {
    const validationFailure = this.validate(samples);

    if (validationFailure !== null) {
      return {
        ok: false,
        error: validationFailure,
      };
    }

    const accumulators = this.aggregate(samples);
    const reports: TableReputationReport[] = [];

    for (const accumulator of accumulators.values()) {
      reports.push(this.toReport(accumulator));
    }

    reports.sort((left, right) => left.tableId.localeCompare(right.tableId));

    return {
      ok: true,
      value: Object.freeze(reports),
    };
  }

  private aggregate(
    samples: readonly TableReputationSample[],
  ): Map<string, TableAccumulator> {
    const accumulators = new Map<string, TableAccumulator>();

    for (const sample of samples) {
      const current = accumulators.get(sample.tableId);

      if (current === undefined) {
        accumulators.set(sample.tableId, {
          tableId: sample.tableId,
          sampleCount: 1,
          observedRounds: sample.observedRounds,
          paperSignals: sample.paperSignals,
          blockedSignals: sample.blockedSignals,
          favorableSignals: sample.favorableSignals,
          volatilityScoreSum: sample.volatilityScore,
          consensusScoreSum: sample.consensusScore,
          confidenceScoreSum: sample.confidenceScore,
          maxDrawdownUnits: sample.maxDrawdownUnits,
          certificationFailureCount: sample.certificationFailureCount,
          operatorViolationCount: sample.operatorViolationCount,
        });
      } else {
        current.sampleCount += 1;
        current.observedRounds += sample.observedRounds;
        current.paperSignals += sample.paperSignals;
        current.blockedSignals += sample.blockedSignals;
        current.favorableSignals += sample.favorableSignals;
        current.volatilityScoreSum += sample.volatilityScore;
        current.consensusScoreSum += sample.consensusScore;
        current.confidenceScoreSum += sample.confidenceScore;
        current.maxDrawdownUnits = Math.max(
          current.maxDrawdownUnits,
          sample.maxDrawdownUnits,
        );
        current.certificationFailureCount += sample.certificationFailureCount;
        current.operatorViolationCount += sample.operatorViolationCount;
      }
    }

    return accumulators;
  }

  private toReport(accumulator: TableAccumulator): TableReputationReport {
    const blockRate = safeRatio(accumulator.blockedSignals, accumulator.paperSignals);
    const favorableRate = safeRatio(
      accumulator.favorableSignals,
      accumulator.paperSignals,
    );
    const averageVolatilityScore = safeRatio(
      accumulator.volatilityScoreSum,
      accumulator.sampleCount,
    );
    const averageConsensusScore = safeRatio(
      accumulator.consensusScoreSum,
      accumulator.sampleCount,
    );
    const averageConfidenceScore = safeRatio(
      accumulator.confidenceScoreSum,
      accumulator.sampleCount,
    );

    const stabilityScore = clamp01(1 - averageVolatilityScore);
    const blockHealthScore = clamp01(1 - blockRate);

    const drawdownPenalty =
      accumulator.maxDrawdownUnits > this.policy.maximumDrawdownUnits ? 0.25 : 0;
    const certificationPenalty =
      accumulator.certificationFailureCount >
      this.policy.maximumCertificationFailures
        ? 0.2
        : 0;
    const operatorPenalty =
      accumulator.operatorViolationCount > this.policy.maximumOperatorViolations
        ? 0.2
        : 0;

    const reputationScore = clamp01(
      stabilityScore * 0.3 +
        averageConsensusScore * 0.25 +
        averageConfidenceScore * 0.25 +
        blockHealthScore * 0.2 -
        drawdownPenalty -
        certificationPenalty -
        operatorPenalty,
    );

    const status = this.resolveStatus(
      accumulator,
      reputationScore,
      averageVolatilityScore,
      blockRate,
    );

    const reasons = this.resolveReasons(
      accumulator,
      reputationScore,
      averageVolatilityScore,
      blockRate,
    );

    return Object.freeze({
      tableId: accumulator.tableId,
      status,
      reputationScore,
      sampleCount: accumulator.sampleCount,
      observedRounds: accumulator.observedRounds,
      paperSignals: accumulator.paperSignals,
      blockRate,
      favorableRate,
      averageVolatilityScore,
      averageConsensusScore,
      averageConfidenceScore,
      maxDrawdownUnits: accumulator.maxDrawdownUnits,
      reasons,
      productionMoneyAllowed: false,
      liveMoneyAuthorization: false,
      paperOnly: true,
    });
  }

  private resolveStatus(
    accumulator: TableAccumulator,
    reputationScore: number,
    averageVolatilityScore: number,
    blockRate: number,
  ): TableReputationStatus {
    if (this.policy.productionMoneyAllowed || this.policy.liveMoneyAuthorization) {
      return 'BLOCKED_PAPER';
    }

    if (accumulator.sampleCount === 0 || accumulator.paperSignals === 0) {
      return 'BLOCKED_PAPER';
    }

    if (averageVolatilityScore > this.policy.maximumVolatilityScore) {
      return 'BLOCKED_PAPER';
    }

    if (blockRate > this.policy.maximumBlockRate) {
      return 'BLOCKED_PAPER';
    }

    if (accumulator.maxDrawdownUnits > this.policy.maximumDrawdownUnits) {
      return 'BLOCKED_PAPER';
    }

    if (
      accumulator.certificationFailureCount >
      this.policy.maximumCertificationFailures
    ) {
      return 'BLOCKED_PAPER';
    }

    if (accumulator.operatorViolationCount > this.policy.maximumOperatorViolations) {
      return 'BLOCKED_PAPER';
    }

    if (
      accumulator.sampleCount < this.policy.minimumSamples ||
      accumulator.observedRounds < this.policy.minimumObservedRounds
    ) {
      return 'NEUTRAL_PAPER';
    }

    if (reputationScore >= this.policy.minimumStableScore) {
      return 'STABLE_PAPER';
    }

    if (reputationScore >= this.policy.minimumNeutralScore) {
      return 'NEUTRAL_PAPER';
    }

    return 'DEGRADED_PAPER';
  }

  private resolveReasons(
    accumulator: TableAccumulator,
    reputationScore: number,
    averageVolatilityScore: number,
    blockRate: number,
  ): readonly TableReputationReason[] {
    const reasons: TableReputationReason[] = ['PAPER_ONLY_POLICY_LOCK'];

    if (accumulator.paperSignals === 0) {
      reasons.push('NO_HISTORY');
    }

    if (
      accumulator.sampleCount < this.policy.minimumSamples ||
      accumulator.observedRounds < this.policy.minimumObservedRounds
    ) {
      reasons.push('LOW_SAMPLE_SIZE');
    }

    if (averageVolatilityScore > this.policy.maximumVolatilityScore) {
      reasons.push('EXCESSIVE_VOLATILITY');
    }

    if (blockRate > this.policy.maximumBlockRate) {
      reasons.push('EXCESSIVE_BLOCK_RATE');
    }

    if (accumulator.maxDrawdownUnits > this.policy.maximumDrawdownUnits) {
      reasons.push('EXCESSIVE_DRAWDOWN');
    }

    if (
      accumulator.certificationFailureCount >
      this.policy.maximumCertificationFailures
    ) {
      reasons.push('CERTIFICATION_RISK');
    }

    if (accumulator.operatorViolationCount > this.policy.maximumOperatorViolations) {
      reasons.push('OPERATOR_RISK');
    }

    if (reputationScore >= this.policy.minimumStableScore) {
      reasons.push('STABLE_CONTEXT');
    } else if (reputationScore < this.policy.minimumNeutralScore) {
      reasons.push('UNSTABLE_CONTEXT');
    } else {
      reasons.push('INSUFFICIENT_CONFIDENCE');
    }

    return Object.freeze(reasons);
  }

  private validate(
    samples: readonly TableReputationSample[],
  ): TableReputationFailure | null {
    for (const sample of samples) {
      if (sample.tableId.trim().length === 0) {
        return {
          code: 'INVALID_TABLE_REPUTATION_INPUT',
          message: 'tableId must not be empty',
        };
      }

      if (sample.sessionId.trim().length === 0) {
        return {
          code: 'INVALID_TABLE_REPUTATION_INPUT',
          message: 'sessionId must not be empty',
        };
      }

      const counters = [
        sample.observedRounds,
        sample.paperSignals,
        sample.blockedSignals,
        sample.favorableSignals,
        sample.maxDrawdownUnits,
        sample.certificationFailureCount,
        sample.operatorViolationCount,
      ];

      if (counters.some((value) => value < 0)) {
        return {
          code: 'INVALID_TABLE_REPUTATION_INPUT',
          message: 'numeric counters must not be negative',
        };
      }

      const normalizedScores = [
        sample.volatilityScore,
        sample.consensusScore,
        sample.confidenceScore,
      ];

      if (normalizedScores.some((value) => value < 0 || value > 1)) {
        return {
          code: 'INVALID_TABLE_REPUTATION_INPUT',
          message: 'normalized scores must be between 0 and 1',
        };
      }

      if (sample.favorableSignals + sample.blockedSignals > sample.paperSignals) {
        return {
          code: 'INVALID_TABLE_REPUTATION_INPUT',
          message:
            'favorableSignals plus blockedSignals must not exceed paperSignals',
        };
      }
    }

    return null;
  }
}
