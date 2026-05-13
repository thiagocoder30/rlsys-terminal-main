import crypto from 'crypto';
import { DomainError, err, ok, type Result } from '../shared/Result';

export type MonteCarloResearchStatus = 'ROBUST_UNDER_VARIANCE' | 'FRAGILE_UNDER_VARIANCE' | 'INCONCLUSIVE' | 'BLOCKED';

export interface MonteCarloResearchOutcome {
  readonly signalId: string;
  readonly stake: number;
  readonly netProfit: number;
  readonly strategyId?: string;
  readonly regime?: string;
  readonly confidence?: number;
}

export interface MonteCarloResearchPolicy {
  readonly simulationCount?: number;
  readonly sequenceLength?: number;
  readonly minOutcomes?: number;
  readonly maxOutcomes?: number;
  readonly maxSimulationCount?: number;
  readonly maxSequenceLength?: number;
  readonly minSurvivalRate?: number;
  readonly minMedianReturnRate?: number;
  readonly maxP95DrawdownRate?: number;
  readonly maxRuinRate?: number;
  readonly ruinThresholdRate?: number;
}

export interface MonteCarloResearchRequest {
  readonly experimentId: string;
  readonly outcomes: readonly MonteCarloResearchOutcome[];
  readonly startingBankroll: number;
  readonly seed?: number;
  readonly policy?: MonteCarloResearchPolicy;
}

export interface MonteCarloSimulationSummary {
  readonly index: number;
  readonly endingBankroll: number;
  readonly totalNetProfit: number;
  readonly returnRate: number;
  readonly maxDrawdown: number;
  readonly maxDrawdownRate: number;
  readonly ruined: boolean;
}

export interface MonteCarloResearchMetrics {
  readonly simulationCount: number;
  readonly sequenceLength: number;
  readonly startingBankroll: number;
  readonly survivalRate: number;
  readonly ruinRate: number;
  readonly medianEndingBankroll: number;
  readonly medianReturnRate: number;
  readonly p05EndingBankroll: number;
  readonly p95DrawdownRate: number;
  readonly averageReturnRate: number;
  readonly worstReturnRate: number;
  readonly bestReturnRate: number;
  readonly varianceStressScore: number;
}

export interface MonteCarloResearchReport {
  readonly engineVersion: 'monte-carlo-research-studio-v1';
  readonly experimentId: string;
  readonly status: MonteCarloResearchStatus;
  readonly metrics: MonteCarloResearchMetrics;
  readonly simulations: readonly MonteCarloSimulationSummary[];
  readonly blockers: readonly string[];
  readonly warnings: readonly string[];
  readonly checksum: string;
}

interface NormalizedPolicy {
  readonly simulationCount: number;
  readonly sequenceLength: number;
  readonly minOutcomes: number;
  readonly maxOutcomes: number;
  readonly maxSimulationCount: number;
  readonly maxSequenceLength: number;
  readonly minSurvivalRate: number;
  readonly minMedianReturnRate: number;
  readonly maxP95DrawdownRate: number;
  readonly maxRuinRate: number;
  readonly ruinThresholdRate: number;
}

const DEFAULT_POLICY: NormalizedPolicy = {
  simulationCount: 250,
  sequenceLength: 120,
  minOutcomes: 30,
  maxOutcomes: 100_000,
  maxSimulationCount: 2_000,
  maxSequenceLength: 5_000,
  minSurvivalRate: 0.92,
  minMedianReturnRate: 0.01,
  maxP95DrawdownRate: 0.35,
  maxRuinRate: 0.08,
  ruinThresholdRate: 0.4
};

/**
 * Stress-tests offline research outcomes through deterministic Monte Carlo
 * bootstrap simulations.
 *
 * The studio is intentionally research-only. It does not authorize execution and
 * does not depend on runtime/mobile infrastructure. It measures whether an alpha
 * candidate survives adverse reordering and resampling of outcomes.
 *
 * Complexity:
 * - Time: O(s * t), where s is simulationCount and t is sequenceLength.
 * - Space: O(s), storing bounded simulation summaries only.
 */
export class MonteCarloResearchStudio {
  public run(request: MonteCarloResearchRequest): Result<MonteCarloResearchReport, DomainError> {
    try {
      const validation = this.validateRequest(request);
      if (validation.length > 0) return err(new DomainError(validation.join('; '), 'MONTE_CARLO_RESEARCH_INVALID_REQUEST'));

      const policy = this.normalizePolicy(request.policy);
      const blockers: string[] = [];
      const warnings: string[] = [];

      if (request.outcomes.length < policy.minOutcomes) blockers.push(`outcomes ${request.outcomes.length} below minOutcomes ${policy.minOutcomes}`);
      if (request.outcomes.length > policy.maxOutcomes) blockers.push(`outcomes ${request.outcomes.length} exceeds maxOutcomes ${policy.maxOutcomes}`);
      if (policy.simulationCount > policy.maxSimulationCount) blockers.push(`simulationCount ${policy.simulationCount} exceeds maxSimulationCount ${policy.maxSimulationCount}`);
      if (policy.sequenceLength > policy.maxSequenceLength) blockers.push(`sequenceLength ${policy.sequenceLength} exceeds maxSequenceLength ${policy.maxSequenceLength}`);

      const simulations = blockers.length > 0 ? [] : this.simulate(request.outcomes, request.startingBankroll, request.seed ?? 1337, policy);
      const metrics = this.metrics(simulations, request.startingBankroll, policy);
      blockers.push(...this.metricBlockers(metrics, policy));
      warnings.push(...this.warnings(metrics, policy));
      const status = this.status(blockers, warnings, metrics, policy);

      const reportWithoutChecksum = {
        engineVersion: 'monte-carlo-research-studio-v1' as const,
        experimentId: request.experimentId.trim(),
        status,
        metrics,
        simulations,
        blockers,
        warnings
      };

      return ok({ ...reportWithoutChecksum, checksum: this.checksum(reportWithoutChecksum) });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown monte carlo research error';
      return err(new DomainError(message, 'MONTE_CARLO_RESEARCH_UNEXPECTED_ERROR'));
    }
  }

  private validateRequest(request: MonteCarloResearchRequest): string[] {
    if (!request || typeof request !== 'object') return ['request must be an object'];
    const errors: string[] = [];
    if (typeof request.experimentId !== 'string' || request.experimentId.trim().length === 0) errors.push('experimentId is required');
    if (!Array.isArray(request.outcomes)) errors.push('outcomes must be an array');
    if (!Number.isFinite(request.startingBankroll) || request.startingBankroll <= 0) errors.push('startingBankroll must be positive');
    if (request.seed !== undefined && (!Number.isInteger(request.seed) || request.seed < 0)) errors.push('seed must be a non-negative integer');

    if (Array.isArray(request.outcomes)) {
      for (let index = 0; index < request.outcomes.length; index += 1) {
        const outcome = request.outcomes[index];
        if (!outcome || typeof outcome !== 'object') {
          errors.push(`outcome[${index}] must be an object`);
          continue;
        }
        if (typeof outcome.signalId !== 'string' || outcome.signalId.trim().length === 0) errors.push(`outcome[${index}].signalId is required`);
        if (!Number.isFinite(outcome.stake) || outcome.stake <= 0) errors.push(`outcome[${index}].stake must be positive`);
        if (!Number.isFinite(outcome.netProfit)) errors.push(`outcome[${index}].netProfit must be finite`);
        if (outcome.confidence !== undefined && (!Number.isFinite(outcome.confidence) || outcome.confidence < 0 || outcome.confidence > 1)) errors.push(`outcome[${index}].confidence must be between 0 and 1`);
      }
    }

    return errors;
  }

  private normalizePolicy(policy?: MonteCarloResearchPolicy): NormalizedPolicy {
    return {
      simulationCount: this.positiveInt(policy?.simulationCount, DEFAULT_POLICY.simulationCount),
      sequenceLength: this.positiveInt(policy?.sequenceLength, DEFAULT_POLICY.sequenceLength),
      minOutcomes: this.positiveInt(policy?.minOutcomes, DEFAULT_POLICY.minOutcomes),
      maxOutcomes: this.positiveInt(policy?.maxOutcomes, DEFAULT_POLICY.maxOutcomes),
      maxSimulationCount: this.positiveInt(policy?.maxSimulationCount, DEFAULT_POLICY.maxSimulationCount),
      maxSequenceLength: this.positiveInt(policy?.maxSequenceLength, DEFAULT_POLICY.maxSequenceLength),
      minSurvivalRate: this.ratio(policy?.minSurvivalRate, DEFAULT_POLICY.minSurvivalRate),
      minMedianReturnRate: this.finite(policy?.minMedianReturnRate, DEFAULT_POLICY.minMedianReturnRate),
      maxP95DrawdownRate: this.ratio(policy?.maxP95DrawdownRate, DEFAULT_POLICY.maxP95DrawdownRate),
      maxRuinRate: this.ratio(policy?.maxRuinRate, DEFAULT_POLICY.maxRuinRate),
      ruinThresholdRate: this.ratio(policy?.ruinThresholdRate, DEFAULT_POLICY.ruinThresholdRate)
    };
  }

  private positiveInt(value: number | undefined, fallback: number): number {
    return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : fallback;
  }

  private ratio(value: number | undefined, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1 ? value : fallback;
  }

  private finite(value: number | undefined, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  }

  private simulate(
    outcomes: readonly MonteCarloResearchOutcome[],
    startingBankroll: number,
    seed: number,
    policy: NormalizedPolicy
  ): MonteCarloSimulationSummary[] {
    const summaries: MonteCarloSimulationSummary[] = [];
    let rngState = seed >>> 0;
    const ruinThreshold = startingBankroll * policy.ruinThresholdRate;

    for (let simulationIndex = 0; simulationIndex < policy.simulationCount; simulationIndex += 1) {
      let bankroll = startingBankroll;
      let peak = startingBankroll;
      let maxDrawdown = 0;
      let ruined = false;

      for (let step = 0; step < policy.sequenceLength; step += 1) {
        rngState = this.nextRandom(rngState);
        const outcomeIndex = rngState % outcomes.length;
        bankroll += outcomes[outcomeIndex].netProfit;
        if (bankroll > peak) peak = bankroll;
        const drawdown = peak - bankroll;
        if (drawdown > maxDrawdown) maxDrawdown = drawdown;
        if (bankroll <= ruinThreshold) ruined = true;
      }

      const totalNetProfit = bankroll - startingBankroll;
      summaries.push({
        index: simulationIndex,
        endingBankroll: this.round(bankroll),
        totalNetProfit: this.round(totalNetProfit),
        returnRate: this.round(totalNetProfit / startingBankroll),
        maxDrawdown: this.round(maxDrawdown),
        maxDrawdownRate: this.round(maxDrawdown / startingBankroll),
        ruined
      });
    }

    return summaries;
  }

  private nextRandom(state: number): number {
    return (Math.imul(1664525, state) + 1013904223) >>> 0;
  }

  private metrics(simulations: readonly MonteCarloSimulationSummary[], startingBankroll: number, policy: NormalizedPolicy): MonteCarloResearchMetrics {
    if (simulations.length === 0) {
      return {
        simulationCount: policy.simulationCount,
        sequenceLength: policy.sequenceLength,
        startingBankroll,
        survivalRate: 0,
        ruinRate: 1,
        medianEndingBankroll: 0,
        medianReturnRate: 0,
        p05EndingBankroll: 0,
        p95DrawdownRate: 1,
        averageReturnRate: 0,
        worstReturnRate: 0,
        bestReturnRate: 0,
        varianceStressScore: 0
      };
    }

    const ending = simulations.map((simulation) => simulation.endingBankroll).sort((a, b) => a - b);
    const returns = simulations.map((simulation) => simulation.returnRate).sort((a, b) => a - b);
    const drawdowns = simulations.map((simulation) => simulation.maxDrawdownRate).sort((a, b) => a - b);
    const ruinedCount = simulations.filter((simulation) => simulation.ruined).length;
    const averageReturnRate = simulations.reduce((sum, simulation) => sum + simulation.returnRate, 0) / simulations.length;
    const survivalRate = 1 - ruinedCount / simulations.length;
    const p95DrawdownRate = this.percentile(drawdowns, 0.95);
    const medianReturnRate = this.percentile(returns, 0.5);
    const riskPenalty = Math.max(0, 1 - p95DrawdownRate / Math.max(policy.maxP95DrawdownRate, 0.000001));
    const survivalScore = Math.max(0, survivalRate - policy.minSurvivalRate) / Math.max(1 - policy.minSurvivalRate, 0.000001);
    const returnScore = Math.max(0, medianReturnRate - policy.minMedianReturnRate) / Math.max(Math.abs(policy.minMedianReturnRate) + 0.05, 0.000001);

    return {
      simulationCount: simulations.length,
      sequenceLength: policy.sequenceLength,
      startingBankroll,
      survivalRate: this.round(survivalRate),
      ruinRate: this.round(ruinedCount / simulations.length),
      medianEndingBankroll: this.round(this.percentile(ending, 0.5)),
      medianReturnRate: this.round(medianReturnRate),
      p05EndingBankroll: this.round(this.percentile(ending, 0.05)),
      p95DrawdownRate: this.round(p95DrawdownRate),
      averageReturnRate: this.round(averageReturnRate),
      worstReturnRate: this.round(returns[0]),
      bestReturnRate: this.round(returns[returns.length - 1]),
      varianceStressScore: this.round(Math.min(1, (survivalScore * 0.45) + (returnScore * 0.35) + (riskPenalty * 0.2)))
    };
  }

  private metricBlockers(metrics: MonteCarloResearchMetrics, policy: NormalizedPolicy): string[] {
    const blockers: string[] = [];
    if (metrics.simulationCount === 0) return blockers;
    if (metrics.ruinRate > policy.maxRuinRate) blockers.push(`ruinRate ${metrics.ruinRate} exceeds maxRuinRate ${policy.maxRuinRate}`);
    if (metrics.p95DrawdownRate > policy.maxP95DrawdownRate) blockers.push(`p95DrawdownRate ${metrics.p95DrawdownRate} exceeds maxP95DrawdownRate ${policy.maxP95DrawdownRate}`);
    return blockers;
  }

  private warnings(metrics: MonteCarloResearchMetrics, policy: NormalizedPolicy): string[] {
    const warnings: string[] = [];
    if (metrics.simulationCount === 0) return warnings;
    if (metrics.survivalRate < policy.minSurvivalRate) warnings.push(`survivalRate ${metrics.survivalRate} below minSurvivalRate ${policy.minSurvivalRate}`);
    if (metrics.medianReturnRate < policy.minMedianReturnRate) warnings.push(`medianReturnRate ${metrics.medianReturnRate} below minMedianReturnRate ${policy.minMedianReturnRate}`);
    if (metrics.varianceStressScore < 0.35) warnings.push('varianceStressScore is weak under Monte Carlo stress');
    return warnings;
  }

  private status(
    blockers: readonly string[],
    warnings: readonly string[],
    metrics: MonteCarloResearchMetrics,
    policy: NormalizedPolicy
  ): MonteCarloResearchStatus {
    if (blockers.length > 0) return 'BLOCKED';
    if (metrics.simulationCount === 0) return 'BLOCKED';
    const passesCore = metrics.survivalRate >= policy.minSurvivalRate && metrics.medianReturnRate >= policy.minMedianReturnRate && metrics.varianceStressScore >= 0.55;
    if (passesCore && warnings.length === 0) return 'ROBUST_UNDER_VARIANCE';
    if (metrics.medianReturnRate < 0 || metrics.survivalRate < policy.minSurvivalRate * 0.9) return 'FRAGILE_UNDER_VARIANCE';
    return 'INCONCLUSIVE';
  }

  private percentile(sortedValues: readonly number[], percentile: number): number {
    if (sortedValues.length === 0) return 0;
    const bounded = Math.min(1, Math.max(0, percentile));
    const index = Math.min(sortedValues.length - 1, Math.floor(bounded * (sortedValues.length - 1)));
    return sortedValues[index];
  }

  private checksum(payload: unknown): string {
    return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  }

  private round(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.round(value * 1_000_000) / 1_000_000;
  }
}
