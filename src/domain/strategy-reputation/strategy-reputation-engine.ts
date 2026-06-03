export type StrategyReputationStatus =
  | 'TRUSTED_PAPER'
  | 'NEUTRAL_PAPER'
  | 'DEGRADED_PAPER'
  | 'BLOCKED_PAPER';

export type StrategyReputationReason =
  | 'NO_HISTORY'
  | 'LOW_SAMPLE_SIZE'
  | 'POSITIVE_PAPER_CONSISTENCY'
  | 'NEGATIVE_PAPER_CONSISTENCY'
  | 'EXCESSIVE_DRAWDOWN'
  | 'OPERATOR_DISCIPLINE_RISK'
  | 'CERTIFICATION_RISK'
  | 'INSUFFICIENT_CONFIDENCE'
  | 'PAPER_ONLY_POLICY_LOCK';

export interface StrategyReputationSample {
  readonly strategyId: string;
  readonly paperSignals: number;
  readonly favorableSignals: number;
  readonly blockedSignals: number;
  readonly wins: number;
  readonly losses: number;
  readonly neutralOutcomes: number;
  readonly totalExposureUnits: number;
  readonly maxDrawdownUnits: number;
  readonly operatorViolationCount: number;
  readonly certificationFailureCount: number;
  readonly confidenceScore: number;
}

export interface StrategyReputationPolicy {
  readonly minimumSamples: number;
  readonly minimumTrustedScore: number;
  readonly minimumNeutralScore: number;
  readonly maximumDrawdownUnits: number;
  readonly maximumOperatorViolations: number;
  readonly maximumCertificationFailures: number;
  readonly productionMoneyAllowed: boolean;
  readonly liveMoneyAuthorization: boolean;
}

export interface StrategyReputationReport {
  readonly strategyId: string;
  readonly status: StrategyReputationStatus;
  readonly reputationScore: number;
  readonly sampleCount: number;
  readonly paperSignals: number;
  readonly winRate: number;
  readonly blockRate: number;
  readonly averageConfidence: number;
  readonly maxDrawdownUnits: number;
  readonly reasons: readonly StrategyReputationReason[];
  readonly productionMoneyAllowed: false;
  readonly liveMoneyAuthorization: false;
  readonly paperOnly: true;
}

export interface StrategyReputationFailure {
  readonly code: 'INVALID_REPUTATION_INPUT';
  readonly message: string;
}

export type StrategyReputationResult =
  | {
      readonly ok: true;
      readonly value: readonly StrategyReputationReport[];
    }
  | {
      readonly ok: false;
      readonly error: StrategyReputationFailure;
    };

interface StrategyAccumulator {
  strategyId: string;
  sampleCount: number;
  paperSignals: number;
  favorableSignals: number;
  blockedSignals: number;
  wins: number;
  losses: number;
  neutralOutcomes: number;
  totalExposureUnits: number;
  maxDrawdownUnits: number;
  operatorViolationCount: number;
  certificationFailureCount: number;
  confidenceScoreSum: number;
}

const DEFAULT_POLICY: StrategyReputationPolicy = Object.freeze({
  minimumSamples: 3,
  minimumTrustedScore: 0.72,
  minimumNeutralScore: 0.48,
  maximumDrawdownUnits: 8,
  maximumOperatorViolations: 0,
  maximumCertificationFailures: 0,
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

export class StrategyReputationEngine {
  private readonly policy: StrategyReputationPolicy;

  public constructor(policy: StrategyReputationPolicy = DEFAULT_POLICY) {
    this.policy = Object.freeze({
      minimumSamples: policy.minimumSamples,
      minimumTrustedScore: policy.minimumTrustedScore,
      minimumNeutralScore: policy.minimumNeutralScore,
      maximumDrawdownUnits: policy.maximumDrawdownUnits,
      maximumOperatorViolations: policy.maximumOperatorViolations,
      maximumCertificationFailures: policy.maximumCertificationFailures,
      productionMoneyAllowed: policy.productionMoneyAllowed,
      liveMoneyAuthorization: policy.liveMoneyAuthorization,
    });
  }

  /**
   * Aggregates paper-only strategy history in O(n) time and O(k) space,
   * where n is the number of samples and k is the number of strategies.
   */
  public evaluate(
    samples: readonly StrategyReputationSample[],
  ): StrategyReputationResult {
    const validationFailure = this.validate(samples);

    if (validationFailure !== null) {
      return {
        ok: false,
        error: validationFailure,
      };
    }

    const accumulators = this.aggregate(samples);
    const reports: StrategyReputationReport[] = [];

    for (const accumulator of accumulators.values()) {
      reports.push(this.toReport(accumulator));
    }

    reports.sort((left, right) => left.strategyId.localeCompare(right.strategyId));

    return {
      ok: true,
      value: Object.freeze(reports),
    };
  }

  private aggregate(
    samples: readonly StrategyReputationSample[],
  ): Map<string, StrategyAccumulator> {
    const accumulators = new Map<string, StrategyAccumulator>();

    for (const sample of samples) {
      const current = accumulators.get(sample.strategyId);

      if (current === undefined) {
        accumulators.set(sample.strategyId, {
          strategyId: sample.strategyId,
          sampleCount: 1,
          paperSignals: sample.paperSignals,
          favorableSignals: sample.favorableSignals,
          blockedSignals: sample.blockedSignals,
          wins: sample.wins,
          losses: sample.losses,
          neutralOutcomes: sample.neutralOutcomes,
          totalExposureUnits: sample.totalExposureUnits,
          maxDrawdownUnits: sample.maxDrawdownUnits,
          operatorViolationCount: sample.operatorViolationCount,
          certificationFailureCount: sample.certificationFailureCount,
          confidenceScoreSum: sample.confidenceScore,
        });
      } else {
        current.sampleCount += 1;
        current.paperSignals += sample.paperSignals;
        current.favorableSignals += sample.favorableSignals;
        current.blockedSignals += sample.blockedSignals;
        current.wins += sample.wins;
        current.losses += sample.losses;
        current.neutralOutcomes += sample.neutralOutcomes;
        current.totalExposureUnits += sample.totalExposureUnits;
        current.maxDrawdownUnits = Math.max(
          current.maxDrawdownUnits,
          sample.maxDrawdownUnits,
        );
        current.operatorViolationCount += sample.operatorViolationCount;
        current.certificationFailureCount += sample.certificationFailureCount;
        current.confidenceScoreSum += sample.confidenceScore;
      }
    }

    return accumulators;
  }

  private toReport(accumulator: StrategyAccumulator): StrategyReputationReport {
    const reasons: StrategyReputationReason[] = ['PAPER_ONLY_POLICY_LOCK'];

    const decisiveOutcomes = accumulator.wins + accumulator.losses;
    const winRate = safeRatio(accumulator.wins, decisiveOutcomes);
    const blockRate = safeRatio(accumulator.blockedSignals, accumulator.paperSignals);
    const averageConfidence = safeRatio(
      accumulator.confidenceScoreSum,
      accumulator.sampleCount,
    );

    const outcomeScore = decisiveOutcomes === 0 ? 0.5 : winRate;
    const confidenceScore = averageConfidence;
    const blockPenalty = blockRate * 0.2;
    const drawdownPenalty =
      accumulator.maxDrawdownUnits > this.policy.maximumDrawdownUnits ? 0.25 : 0;
    const disciplinePenalty =
      accumulator.operatorViolationCount > this.policy.maximumOperatorViolations
        ? 0.2
        : 0;
    const certificationPenalty =
      accumulator.certificationFailureCount >
      this.policy.maximumCertificationFailures
        ? 0.25
        : 0;

    const reputationScore = clamp01(
      outcomeScore * 0.45 +
        confidenceScore * 0.35 +
        (1 - blockRate) * 0.2 -
        blockPenalty -
        drawdownPenalty -
        disciplinePenalty -
        certificationPenalty,
    );

    const status = this.resolveStatus(accumulator, reputationScore);
    const resolvedReasons = this.resolveReasons(
      accumulator,
      reputationScore,
      reasons,
    );

    return Object.freeze({
      strategyId: accumulator.strategyId,
      status,
      reputationScore,
      sampleCount: accumulator.sampleCount,
      paperSignals: accumulator.paperSignals,
      winRate,
      blockRate,
      averageConfidence,
      maxDrawdownUnits: accumulator.maxDrawdownUnits,
      reasons: Object.freeze(resolvedReasons),
      productionMoneyAllowed: false,
      liveMoneyAuthorization: false,
      paperOnly: true,
    });
  }

  private resolveStatus(
    accumulator: StrategyAccumulator,
    reputationScore: number,
  ): StrategyReputationStatus {
    if (this.policy.productionMoneyAllowed || this.policy.liveMoneyAuthorization) {
      return 'BLOCKED_PAPER';
    }

    if (accumulator.sampleCount === 0 || accumulator.paperSignals === 0) {
      return 'BLOCKED_PAPER';
    }

    if (accumulator.maxDrawdownUnits > this.policy.maximumDrawdownUnits) {
      return 'BLOCKED_PAPER';
    }

    if (
      accumulator.operatorViolationCount > this.policy.maximumOperatorViolations
    ) {
      return 'BLOCKED_PAPER';
    }

    if (
      accumulator.certificationFailureCount >
      this.policy.maximumCertificationFailures
    ) {
      return 'BLOCKED_PAPER';
    }

    if (accumulator.sampleCount < this.policy.minimumSamples) {
      return 'NEUTRAL_PAPER';
    }

    if (reputationScore >= this.policy.minimumTrustedScore) {
      return 'TRUSTED_PAPER';
    }

    if (reputationScore >= this.policy.minimumNeutralScore) {
      return 'NEUTRAL_PAPER';
    }

    return 'DEGRADED_PAPER';
  }

  private resolveReasons(
    accumulator: StrategyAccumulator,
    reputationScore: number,
    baseReasons: readonly StrategyReputationReason[],
  ): readonly StrategyReputationReason[] {
    const reasons: StrategyReputationReason[] = [...baseReasons];

    if (accumulator.paperSignals === 0) {
      reasons.push('NO_HISTORY');
    }

    if (accumulator.sampleCount < this.policy.minimumSamples) {
      reasons.push('LOW_SAMPLE_SIZE');
    }

    if (accumulator.maxDrawdownUnits > this.policy.maximumDrawdownUnits) {
      reasons.push('EXCESSIVE_DRAWDOWN');
    }

    if (
      accumulator.operatorViolationCount > this.policy.maximumOperatorViolations
    ) {
      reasons.push('OPERATOR_DISCIPLINE_RISK');
    }

    if (
      accumulator.certificationFailureCount >
      this.policy.maximumCertificationFailures
    ) {
      reasons.push('CERTIFICATION_RISK');
    }

    if (reputationScore >= this.policy.minimumTrustedScore) {
      reasons.push('POSITIVE_PAPER_CONSISTENCY');
    } else if (reputationScore < this.policy.minimumNeutralScore) {
      reasons.push('NEGATIVE_PAPER_CONSISTENCY');
    } else {
      reasons.push('INSUFFICIENT_CONFIDENCE');
    }

    return Object.freeze(reasons);
  }

  private validate(
    samples: readonly StrategyReputationSample[],
  ): StrategyReputationFailure | null {
    for (const sample of samples) {
      if (sample.strategyId.trim().length === 0) {
        return {
          code: 'INVALID_REPUTATION_INPUT',
          message: 'strategyId must not be empty',
        };
      }

      const counters = [
        sample.paperSignals,
        sample.favorableSignals,
        sample.blockedSignals,
        sample.wins,
        sample.losses,
        sample.neutralOutcomes,
        sample.totalExposureUnits,
        sample.maxDrawdownUnits,
        sample.operatorViolationCount,
        sample.certificationFailureCount,
      ];

      if (counters.some((value) => value < 0)) {
        return {
          code: 'INVALID_REPUTATION_INPUT',
          message: 'numeric counters must not be negative',
        };
      }

      if (sample.confidenceScore < 0 || sample.confidenceScore > 1) {
        return {
          code: 'INVALID_REPUTATION_INPUT',
          message: 'confidenceScore must be between 0 and 1',
        };
      }

      if (sample.favorableSignals + sample.blockedSignals > sample.paperSignals) {
        return {
          code: 'INVALID_REPUTATION_INPUT',
          message:
            'favorableSignals plus blockedSignals must not exceed paperSignals',
        };
      }
    }

    return null;
  }
}
