export type AdaptiveConfidenceStatus =
  | 'CALIBRATED_PAPER_FAVORABLE'
  | 'CALIBRATED_OBSERVE'
  | 'CALIBRATED_BLOCKED';

export type AdaptiveConfidenceReason =
  | 'PAPER_ONLY_POLICY_LOCK'
  | 'STRATEGY_REPUTATION_SUPPORT'
  | 'TABLE_REPUTATION_SUPPORT'
  | 'CONSENSUS_SUPPORT'
  | 'VOLATILITY_PENALTY'
  | 'RISK_PENALTY'
  | 'OPERATOR_PENALTY'
  | 'LOW_STRATEGY_REPUTATION'
  | 'LOW_TABLE_REPUTATION'
  | 'LOW_CONSENSUS'
  | 'INSUFFICIENT_CALIBRATED_CONFIDENCE'
  | 'DEFENSIVE_BLOCK';

export interface AdaptiveConfidenceInput {
  readonly strategyId: string;
  readonly tableId: string;
  readonly baseConfidence: number;
  readonly strategyReputationScore: number;
  readonly tableReputationScore: number;
  readonly consensusScore: number;
  readonly volatilityScore: number;
  readonly riskScore: number;
  readonly operatorScore: number;
}

export interface AdaptiveConfidencePolicy {
  readonly minimumPaperFavorableConfidence: number;
  readonly minimumObserveConfidence: number;
  readonly minimumStrategyReputationScore: number;
  readonly minimumTableReputationScore: number;
  readonly minimumConsensusScore: number;
  readonly maximumVolatilityScore: number;
  readonly maximumRiskScore: number;
  readonly minimumOperatorScore: number;
  readonly productionMoneyAllowed: boolean;
  readonly liveMoneyAuthorization: boolean;
}

export interface AdaptiveConfidenceReport {
  readonly strategyId: string;
  readonly tableId: string;
  readonly status: AdaptiveConfidenceStatus;
  readonly baseConfidence: number;
  readonly calibratedConfidence: number;
  readonly calibrationDelta: number;
  readonly reasons: readonly AdaptiveConfidenceReason[];
  readonly productionMoneyAllowed: false;
  readonly liveMoneyAuthorization: false;
  readonly paperOnly: true;
}

export interface AdaptiveConfidenceFailure {
  readonly code: 'INVALID_ADAPTIVE_CONFIDENCE_INPUT';
  readonly message: string;
}

export type AdaptiveConfidenceResult =
  | {
      readonly ok: true;
      readonly value: AdaptiveConfidenceReport;
    }
  | {
      readonly ok: false;
      readonly error: AdaptiveConfidenceFailure;
    };

const DEFAULT_POLICY: AdaptiveConfidencePolicy = Object.freeze({
  minimumPaperFavorableConfidence: 0.72,
  minimumObserveConfidence: 0.48,
  minimumStrategyReputationScore: 0.5,
  minimumTableReputationScore: 0.5,
  minimumConsensusScore: 0.55,
  maximumVolatilityScore: 0.72,
  maximumRiskScore: 0.62,
  minimumOperatorScore: 0.65,
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

const round4 = (value: number): number => Math.round(value * 10000) / 10000;

export class AdaptiveConfidenceCalibrationEngine {
  private readonly policy: AdaptiveConfidencePolicy;

  public constructor(policy: AdaptiveConfidencePolicy = DEFAULT_POLICY) {
    this.policy = Object.freeze({
      minimumPaperFavorableConfidence: policy.minimumPaperFavorableConfidence,
      minimumObserveConfidence: policy.minimumObserveConfidence,
      minimumStrategyReputationScore: policy.minimumStrategyReputationScore,
      minimumTableReputationScore: policy.minimumTableReputationScore,
      minimumConsensusScore: policy.minimumConsensusScore,
      maximumVolatilityScore: policy.maximumVolatilityScore,
      maximumRiskScore: policy.maximumRiskScore,
      minimumOperatorScore: policy.minimumOperatorScore,
      productionMoneyAllowed: policy.productionMoneyAllowed,
      liveMoneyAuthorization: policy.liveMoneyAuthorization,
    });
  }

  /**
   * Calibrates a single paper suggestion confidence in O(1).
   * The engine is intentionally stateless and idempotent.
   */
  public calibrate(
    input: AdaptiveConfidenceInput,
  ): AdaptiveConfidenceResult {
    const validationFailure = this.validate(input);

    if (validationFailure !== null) {
      return {
        ok: false,
        error: validationFailure,
      };
    }

    const reasons = this.resolveReasons(input);
    const calibratedConfidence = this.calculateCalibratedConfidence(input);
    const status = this.resolveStatus(input, calibratedConfidence, reasons);

    return {
      ok: true,
      value: Object.freeze({
        strategyId: input.strategyId,
        tableId: input.tableId,
        status,
        baseConfidence: input.baseConfidence,
        calibratedConfidence,
        calibrationDelta: round4(calibratedConfidence - input.baseConfidence),
        reasons: Object.freeze(reasons),
        productionMoneyAllowed: false,
        liveMoneyAuthorization: false,
        paperOnly: true,
      }),
    };
  }

  private calculateCalibratedConfidence(input: AdaptiveConfidenceInput): number {
    const reputationSupport =
      input.strategyReputationScore * 0.22 + input.tableReputationScore * 0.2;

    const institutionalSupport =
      input.consensusScore * 0.22 + input.operatorScore * 0.16;

    const baseSupport = input.baseConfidence * 0.2;

    const volatilityPenalty =
      input.volatilityScore > this.policy.maximumVolatilityScore
        ? 0.18
        : input.volatilityScore * 0.08;

    const riskPenalty =
      input.riskScore > this.policy.maximumRiskScore
        ? 0.2
        : input.riskScore * 0.1;

    return round4(
      clamp01(baseSupport + reputationSupport + institutionalSupport - volatilityPenalty - riskPenalty),
    );
  }

  private resolveStatus(
    input: AdaptiveConfidenceInput,
    calibratedConfidence: number,
    reasons: readonly AdaptiveConfidenceReason[],
  ): AdaptiveConfidenceStatus {
    if (this.policy.productionMoneyAllowed || this.policy.liveMoneyAuthorization) {
      return 'CALIBRATED_BLOCKED';
    }

    if (reasons.includes('DEFENSIVE_BLOCK')) {
      return 'CALIBRATED_BLOCKED';
    }

    if (calibratedConfidence >= this.policy.minimumPaperFavorableConfidence) {
      return 'CALIBRATED_PAPER_FAVORABLE';
    }

    if (calibratedConfidence >= this.policy.minimumObserveConfidence) {
      return 'CALIBRATED_OBSERVE';
    }

    return 'CALIBRATED_BLOCKED';
  }

  private resolveReasons(
    input: AdaptiveConfidenceInput,
  ): AdaptiveConfidenceReason[] {
    const reasons: AdaptiveConfidenceReason[] = ['PAPER_ONLY_POLICY_LOCK'];

    if (
      input.strategyReputationScore >= this.policy.minimumStrategyReputationScore
    ) {
      reasons.push('STRATEGY_REPUTATION_SUPPORT');
    } else {
      reasons.push('LOW_STRATEGY_REPUTATION');
    }

    if (input.tableReputationScore >= this.policy.minimumTableReputationScore) {
      reasons.push('TABLE_REPUTATION_SUPPORT');
    } else {
      reasons.push('LOW_TABLE_REPUTATION');
    }

    if (input.consensusScore >= this.policy.minimumConsensusScore) {
      reasons.push('CONSENSUS_SUPPORT');
    } else {
      reasons.push('LOW_CONSENSUS');
    }

    if (input.volatilityScore > this.policy.maximumVolatilityScore) {
      reasons.push('VOLATILITY_PENALTY');
    }

    if (input.riskScore > this.policy.maximumRiskScore) {
      reasons.push('RISK_PENALTY');
    }

    if (input.operatorScore < this.policy.minimumOperatorScore) {
      reasons.push('OPERATOR_PENALTY');
    }

    if (
      input.strategyReputationScore < this.policy.minimumStrategyReputationScore ||
      input.tableReputationScore < this.policy.minimumTableReputationScore ||
      input.consensusScore < this.policy.minimumConsensusScore ||
      input.volatilityScore > this.policy.maximumVolatilityScore ||
      input.riskScore > this.policy.maximumRiskScore ||
      input.operatorScore < this.policy.minimumOperatorScore
    ) {
      reasons.push('DEFENSIVE_BLOCK');
    }

    return reasons;
  }

  private validate(
    input: AdaptiveConfidenceInput,
  ): AdaptiveConfidenceFailure | null {
    if (input.strategyId.trim().length === 0) {
      return {
        code: 'INVALID_ADAPTIVE_CONFIDENCE_INPUT',
        message: 'strategyId must not be empty',
      };
    }

    if (input.tableId.trim().length === 0) {
      return {
        code: 'INVALID_ADAPTIVE_CONFIDENCE_INPUT',
        message: 'tableId must not be empty',
      };
    }

    const normalizedValues = [
      input.baseConfidence,
      input.strategyReputationScore,
      input.tableReputationScore,
      input.consensusScore,
      input.volatilityScore,
      input.riskScore,
      input.operatorScore,
    ];

    if (normalizedValues.some((value) => value < 0 || value > 1)) {
      return {
        code: 'INVALID_ADAPTIVE_CONFIDENCE_INPUT',
        message: 'all score values must be between 0 and 1',
      };
    }

    return null;
  }
}
