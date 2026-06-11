export type TableProvider = 'PRAGMATIC' | 'EVOLUTION' | 'CUSTOM';
export type PositionSizingMode = 'BLOCKED' | 'LOW' | 'NORMAL' | 'STRONG' | 'VERY_STRONG';
export type PositionSizingDecision = 'NO_BET' | 'PAPER_STAKE_ALLOWED';

export interface TableLimitProfile {
  readonly provider: TableProvider;
  readonly tableMinBet: number;
  readonly chipStep: number;
}

export interface PositionSizingPolicy {
  readonly baseRiskUnitPercent: number;
  readonly maxRiskUnitMultiplier: number;
  readonly maxStakePercent: number;
  readonly maxDailyExposurePercent: number;
  readonly minConsensusConfidence: number;
  readonly maxConsensusRisk: number;
  readonly drawdownProtectionThresholdPercent: number;
  readonly milestoneProtectionEnabled: true;
  readonly antiMartingale: true;
  readonly paperOnly: true;
  readonly liveMoneyAuthorized: false;
  readonly productionMoneyAllowed: false;
}

export interface PositionSizingInput {
  readonly bankroll: number;
  readonly table: TableLimitProfile;
  readonly consensusConfidenceScore: number;
  readonly consensusRiskScore: number;
  readonly consensusScore?: number;
  readonly dailyRealizedProfitLoss?: number;
  readonly dailyDrawdownPercent?: number;
  readonly currentMilestonePercent?: number | null;
  readonly strategyAgreementLevel?: 'NONE' | 'WEAK' | 'MODERATE' | 'STRONG';
  readonly blockers?: readonly string[];
  readonly warnings?: readonly string[];
  readonly reasons?: readonly string[];
}

export interface PositionSizingRecommendation {
  readonly decision: PositionSizingDecision;
  readonly mode: PositionSizingMode;
  readonly bankroll: number;
  readonly provider: TableProvider;
  readonly tableMinBet: number;
  readonly chipStep: number;
  readonly riskUnitAmount: number;
  readonly riskUnitMultiplier: number;
  readonly rawStakeAmount: number;
  readonly recommendedStakeAmount: number;
  readonly stakePercent: number;
  readonly maxStakeAmount: number;
  readonly maxDailyExposureAmount: number;
  readonly tableCompatible: boolean;
  readonly drawdownProtected: boolean;
  readonly milestoneProtected: boolean;
  readonly paperOnly: true;
  readonly liveMoneyAuthorized: false;
  readonly productionMoneyAllowed: false;
  readonly operatorDecisionRequired: true;
  readonly supervisedRecommendationOnly: true;
  readonly blockers: readonly string[];
  readonly warnings: readonly string[];
  readonly reasons: readonly string[];
  readonly hudSummary: string;
}

const DEFAULT_POLICY: PositionSizingPolicy = Object.freeze({
  baseRiskUnitPercent: 0.5,
  maxRiskUnitMultiplier: 3,
  maxStakePercent: 2,
  maxDailyExposurePercent: 4,
  minConsensusConfidence: 0.58,
  maxConsensusRisk: 0.6,
  drawdownProtectionThresholdPercent: 2,
  milestoneProtectionEnabled: true,
  antiMartingale: true,
  paperOnly: true,
  liveMoneyAuthorized: false,
  productionMoneyAllowed: false,
});

export class InstitutionalPositionSizingEngine {
  public pragmaticProfile(): TableLimitProfile {
    return Object.freeze({
      provider: 'PRAGMATIC',
      tableMinBet: 0.1,
      chipStep: 0.1,
    });
  }

  public evolutionProfile(): TableLimitProfile {
    return Object.freeze({
      provider: 'EVOLUTION',
      tableMinBet: 0.5,
      chipStep: 0.5,
    });
  }

  public customProfile(tableMinBet: number, chipStep: number = tableMinBet): TableLimitProfile {
    return Object.freeze({
      provider: 'CUSTOM',
      tableMinBet: this.normalizeMoney(tableMinBet),
      chipStep: this.normalizeMoney(chipStep),
    });
  }

  public recommend(
    input: PositionSizingInput,
    policyInput: Partial<PositionSizingPolicy> = {},
  ): PositionSizingRecommendation {
    const policy = this.normalizePolicy(policyInput);
    const bankroll = this.normalizeMoney(input.bankroll);
    const table = this.normalizeTable(input.table);
    const consensusConfidenceScore = this.clampRatio(input.consensusConfidenceScore);
    const consensusRiskScore = this.clampRatio(input.consensusRiskScore);
    const dailyDrawdownPercent = Math.max(0, this.normalizePercent(input.dailyDrawdownPercent ?? 0));
    const currentMilestonePercent = input.currentMilestonePercent ?? null;
    const externalBlockers = [...(input.blockers ?? [])];
    const warnings = [...(input.warnings ?? [])];
    const reasons = [
      ...(input.reasons ?? []),
      `POSITION_BANKROLL:${bankroll}`,
      `POSITION_TABLE_MIN:${table.tableMinBet}`,
      `POSITION_CONFIDENCE:${consensusConfidenceScore}`,
      `POSITION_RISK:${consensusRiskScore}`,
    ];

    const riskUnitAmount = this.normalizeMoney(bankroll * (policy.baseRiskUnitPercent / 100));
    const maxStakeAmount = this.normalizeMoney(bankroll * (policy.maxStakePercent / 100));
    const maxDailyExposureAmount = this.normalizeMoney(bankroll * (policy.maxDailyExposurePercent / 100));

    const drawdownProtected = dailyDrawdownPercent >= policy.drawdownProtectionThresholdPercent;
    const milestoneProtected =
      policy.milestoneProtectionEnabled &&
      typeof currentMilestonePercent === 'number' &&
      currentMilestonePercent >= 4;

    const mode = this.resolveMode({
      consensusConfidenceScore,
      consensusRiskScore,
      agreementLevel: input.strategyAgreementLevel ?? 'NONE',
      drawdownProtected,
      milestoneProtected,
      externalBlockers,
      policy,
    });

    const riskUnitMultiplier = this.resolveMultiplier(mode, drawdownProtected, milestoneProtected, policy);
    const rawStakeAmount = this.normalizeMoney(riskUnitAmount * riskUnitMultiplier);
    const roundedStakeAmount = this.roundUpToChip(rawStakeAmount, table.chipStep);
    const recommendedStakeAmount = this.normalizeMoney(Math.max(roundedStakeAmount, table.tableMinBet));
    const stakePercent = bankroll > 0 ? this.normalizePercent((recommendedStakeAmount / bankroll) * 100) : 0;

    const blockers = [...externalBlockers];

    if (bankroll <= 0) {
      blockers.push('POSITION_BANKROLL_INVALID');
    }

    if (consensusConfidenceScore < policy.minConsensusConfidence) {
      blockers.push('POSITION_CONFIDENCE_BELOW_MINIMUM');
    }

    if (consensusRiskScore > policy.maxConsensusRisk) {
      blockers.push('POSITION_RISK_ABOVE_MAXIMUM');
    }

    if (mode === 'BLOCKED') {
      blockers.push('POSITION_MODE_BLOCKED');
    }

    if (riskUnitAmount <= 0) {
      blockers.push('POSITION_RISK_UNIT_INVALID');
    }

    if (recommendedStakeAmount > maxStakeAmount) {
      blockers.push('POSITION_STAKE_EXCEEDS_MAX_PER_ENTRY');
    }

    if (recommendedStakeAmount > maxDailyExposureAmount) {
      blockers.push('POSITION_STAKE_EXCEEDS_DAILY_EXPOSURE');
    }

    if (table.tableMinBet > maxStakeAmount) {
      blockers.push('BANKROLL_INCOMPATIBLE_WITH_TABLE_LIMIT');
    }

    if (drawdownProtected) {
      warnings.push('POSITION_DRAWDOWN_PROTECTION_ACTIVE');
      reasons.push(`POSITION_DRAWDOWN:${dailyDrawdownPercent}`);
    }

    if (milestoneProtected) {
      warnings.push('POSITION_MILESTONE_PROTECTION_ACTIVE');
      reasons.push(`POSITION_MILESTONE:${currentMilestonePercent}`);
    }

    const decision: PositionSizingDecision =
      blockers.length === 0
        ? 'PAPER_STAKE_ALLOWED'
        : 'NO_BET';

    const tableCompatible = !blockers.includes('BANKROLL_INCOMPATIBLE_WITH_TABLE_LIMIT');

    return Object.freeze({
      decision,
      mode,
      bankroll,
      provider: table.provider,
      tableMinBet: table.tableMinBet,
      chipStep: table.chipStep,
      riskUnitAmount,
      riskUnitMultiplier,
      rawStakeAmount,
      recommendedStakeAmount: decision === 'PAPER_STAKE_ALLOWED' ? recommendedStakeAmount : 0,
      stakePercent: decision === 'PAPER_STAKE_ALLOWED' ? stakePercent : 0,
      maxStakeAmount,
      maxDailyExposureAmount,
      tableCompatible,
      drawdownProtected,
      milestoneProtected,
      paperOnly: true,
      liveMoneyAuthorized: false,
      productionMoneyAllowed: false,
      operatorDecisionRequired: true,
      supervisedRecommendationOnly: true,
      blockers: Object.freeze(blockers),
      warnings: Object.freeze(warnings),
      reasons: Object.freeze(reasons),
      hudSummary: this.hudSummary({
        decision,
        mode,
        provider: table.provider,
        recommendedStakeAmount: decision === 'PAPER_STAKE_ALLOWED' ? recommendedStakeAmount : 0,
        stakePercent: decision === 'PAPER_STAKE_ALLOWED' ? stakePercent : 0,
        riskUnitAmount,
        riskUnitMultiplier,
        tableCompatible,
      }),
    });
  }

  private resolveMode(input: {
    readonly consensusConfidenceScore: number;
    readonly consensusRiskScore: number;
    readonly agreementLevel: 'NONE' | 'WEAK' | 'MODERATE' | 'STRONG';
    readonly drawdownProtected: boolean;
    readonly milestoneProtected: boolean;
    readonly externalBlockers: readonly string[];
    readonly policy: PositionSizingPolicy;
  }): PositionSizingMode {
    if (
      input.externalBlockers.length > 0 ||
      input.consensusConfidenceScore < input.policy.minConsensusConfidence ||
      input.consensusRiskScore > input.policy.maxConsensusRisk ||
      input.agreementLevel === 'NONE'
    ) {
      return 'BLOCKED';
    }

    if (input.drawdownProtected) {
      return 'LOW';
    }

    if (input.milestoneProtected) {
      return input.agreementLevel === 'STRONG' && input.consensusConfidenceScore >= 0.82
        ? 'NORMAL'
        : 'LOW';
    }

    if (input.agreementLevel === 'STRONG' && input.consensusConfidenceScore >= 0.9 && input.consensusRiskScore <= 0.25) {
      return 'VERY_STRONG';
    }

    if (input.agreementLevel === 'STRONG' && input.consensusConfidenceScore >= 0.78 && input.consensusRiskScore <= 0.35) {
      return 'STRONG';
    }

    if (input.agreementLevel === 'MODERATE' && input.consensusConfidenceScore >= 0.65 && input.consensusRiskScore <= 0.45) {
      return 'NORMAL';
    }

    return 'LOW';
  }

  private resolveMultiplier(
    mode: PositionSizingMode,
    drawdownProtected: boolean,
    milestoneProtected: boolean,
    policy: PositionSizingPolicy,
  ): number {
    if (mode === 'BLOCKED') {
      return 0;
    }

    if (drawdownProtected) {
      return 1;
    }

    const baseMultiplier = (() => {
      if (mode === 'VERY_STRONG') return 3;
      if (mode === 'STRONG') return 2;
      if (mode === 'NORMAL') return 1.5;
      return 1;
    })();

    const protectedMultiplier = milestoneProtected
      ? Math.min(baseMultiplier, 1.5)
      : baseMultiplier;

    return Math.min(protectedMultiplier, policy.maxRiskUnitMultiplier);
  }

  private normalizePolicy(input: Partial<PositionSizingPolicy>): PositionSizingPolicy {
    return Object.freeze({
      baseRiskUnitPercent: this.positiveNumberOrDefault(input.baseRiskUnitPercent, DEFAULT_POLICY.baseRiskUnitPercent),
      maxRiskUnitMultiplier: this.positiveNumberOrDefault(input.maxRiskUnitMultiplier, DEFAULT_POLICY.maxRiskUnitMultiplier),
      maxStakePercent: this.positiveNumberOrDefault(input.maxStakePercent, DEFAULT_POLICY.maxStakePercent),
      maxDailyExposurePercent: this.positiveNumberOrDefault(input.maxDailyExposurePercent, DEFAULT_POLICY.maxDailyExposurePercent),
      minConsensusConfidence: this.clampRatio(typeof input.minConsensusConfidence === 'number' ? input.minConsensusConfidence : DEFAULT_POLICY.minConsensusConfidence),
      maxConsensusRisk: this.clampRatio(typeof input.maxConsensusRisk === 'number' ? input.maxConsensusRisk : DEFAULT_POLICY.maxConsensusRisk),
      drawdownProtectionThresholdPercent: this.positiveNumberOrDefault(input.drawdownProtectionThresholdPercent, DEFAULT_POLICY.drawdownProtectionThresholdPercent),
      milestoneProtectionEnabled: true,
      antiMartingale: true,
      paperOnly: true,
      liveMoneyAuthorized: false,
      productionMoneyAllowed: false,
    });
  }

  private normalizeTable(table: TableLimitProfile): TableLimitProfile {
    const tableMinBet = this.normalizeMoney(table.tableMinBet);
    const chipStep = this.normalizeMoney(table.chipStep);

    if (tableMinBet <= 0 || chipStep <= 0) {
      throw new Error('POSITION_TABLE_LIMIT_INVALID');
    }

    return Object.freeze({
      provider: table.provider,
      tableMinBet,
      chipStep,
    });
  }

  private roundUpToChip(value: number, chipStep: number): number {
    if (value <= 0) {
      return 0;
    }

    return this.normalizeMoney(Math.ceil(value / chipStep) * chipStep);
  }

  private hudSummary(input: {
    readonly decision: PositionSizingDecision;
    readonly mode: PositionSizingMode;
    readonly provider: TableProvider;
    readonly recommendedStakeAmount: number;
    readonly stakePercent: number;
    readonly riskUnitAmount: number;
    readonly riskUnitMultiplier: number;
    readonly tableCompatible: boolean;
  }): string {
    return [
      `decision=${input.decision}`,
      `mode=${input.mode}`,
      `provider=${input.provider}`,
      `stake=${input.recommendedStakeAmount}`,
      `stakePercent=${input.stakePercent}`,
      `ru=${input.riskUnitAmount}`,
      `ruMultiplier=${input.riskUnitMultiplier}`,
      `tableCompatible=${input.tableCompatible}`,
      'paperOnly=true',
      'liveMoneyAuthorized=false',
    ].join(' | ');
  }

  private normalizeMoney(value: number): number {
    if (!Number.isFinite(value)) {
      return 0;
    }

    return Math.round(value * 100) / 100;
  }

  private normalizePercent(value: number): number {
    if (!Number.isFinite(value)) {
      return 0;
    }

    return Math.round(value * 100) / 100;
  }

  private positiveNumberOrDefault(value: number | undefined, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
  }

  private clampRatio(value: number): number {
    if (!Number.isFinite(value)) {
      return 0;
    }

    return Math.round(Math.max(0, Math.min(1, value)) * 1000) / 1000;
  }
}
