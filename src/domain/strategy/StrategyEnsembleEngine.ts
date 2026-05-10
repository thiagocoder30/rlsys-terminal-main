import { DomainError, err, ok, type Result } from '../shared/Result';

export type StrategyEnsembleVoteStatus = 'SUPPORT' | 'OPPOSE' | 'ABSTAIN' | 'BLOCKED';
export type StrategyEnsembleDecision = 'CONSENSUS' | 'CONFLICT' | 'INSUFFICIENT_SUPPORT' | 'BLOCKED';

export interface StrategyEnsembleVote {
  readonly strategyId: string;
  readonly label: string;
  readonly status: StrategyEnsembleVoteStatus;
  readonly targetId: string;
  readonly targetLabel: string;
  readonly confidence: number;
  readonly evidenceScore: number;
  readonly riskPenalty: number;
  readonly recencyWeight: number;
  readonly weight: number;
}

export interface StrategyEnsembleOptions {
  readonly minSupportVotes: number;
  readonly minConsensusScore: number;
  readonly maxConflictScore: number;
  readonly minSupportWeight: number;
  readonly maxAverageRiskPenalty: number;
}

export interface StrategyEnsembleTargetScore {
  readonly targetId: string;
  readonly targetLabel: string;
  readonly supportVotes: number;
  readonly opposeVotes: number;
  readonly supportWeight: number;
  readonly opposeWeight: number;
  readonly averageConfidence: number;
  readonly averageEvidenceScore: number;
  readonly averageRiskPenalty: number;
  readonly consensusScore: number;
  readonly conflictScore: number;
  readonly supportingStrategies: readonly string[];
  readonly opposingStrategies: readonly string[];
}

export interface StrategyEnsembleReport {
  readonly engineVersion: 'strategy-ensemble-v1';
  readonly voteCount: number;
  readonly activeVoteCount: number;
  readonly decision: StrategyEnsembleDecision;
  readonly selectedTarget: StrategyEnsembleTargetScore | null;
  readonly targets: readonly StrategyEnsembleTargetScore[];
  readonly supportWeight: number;
  readonly opposingWeight: number;
  readonly abstainWeight: number;
  readonly blockedWeight: number;
  readonly blockers: readonly string[];
  readonly warnings: readonly string[];
}

interface MutableTargetAccumulator {
  readonly targetId: string;
  readonly targetLabel: string;
  supportVotes: number;
  opposeVotes: number;
  supportWeight: number;
  opposeWeight: number;
  confidenceWeightedSum: number;
  evidenceWeightedSum: number;
  riskWeightedSum: number;
  confidenceWeight: number;
  supportingStrategies: string[];
  opposingStrategies: string[];
}

const DEFAULT_OPTIONS: StrategyEnsembleOptions = {
  minSupportVotes: 2,
  minConsensusScore: 0.58,
  maxConflictScore: 0.42,
  minSupportWeight: 0.5,
  maxAverageRiskPenalty: 0.48
};

/**
 * Aggregates multiple strategy votes into a deterministic ensemble decision.
 *
 * This domain service is side-effect free and independent from UI, storage,
 * HTTP or vendor APIs. It applies a weighted voting policy so a single high
 * win-rate strategy cannot override broad disagreement from other strategies.
 * Complexity is O(n + t log t), where n is the number of votes and t is the
 * number of distinct targets; memory is O(t), bounded by active hypotheses.
 */
export class StrategyEnsembleEngine {
  private readonly options: StrategyEnsembleOptions;

  public constructor(options: Partial<StrategyEnsembleOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.validateOptions(this.options);
  }

  public evaluate(votes: readonly StrategyEnsembleVote[]): Result<StrategyEnsembleReport, DomainError> {
    try {
      if (!Array.isArray(votes)) throw new Error('invalid_strategy_ensemble_votes');

      const targets = new Map<string, MutableTargetAccumulator>();
      let supportWeight = 0;
      let opposingWeight = 0;
      let abstainWeight = 0;
      let blockedWeight = 0;

      for (const vote of votes) {
        this.validateVote(vote);
        const voteWeight = this.voteWeight(vote);

        if (vote.status === 'ABSTAIN') {
          abstainWeight += voteWeight;
          continue;
        }

        if (vote.status === 'BLOCKED') {
          blockedWeight += voteWeight;
          continue;
        }

        const accumulator = this.getAccumulator(targets, vote);
        if (vote.status === 'SUPPORT') {
          supportWeight += voteWeight;
          accumulator.supportVotes += 1;
          accumulator.supportWeight += voteWeight;
          accumulator.confidenceWeightedSum += vote.confidence * voteWeight;
          accumulator.evidenceWeightedSum += vote.evidenceScore * voteWeight;
          accumulator.riskWeightedSum += vote.riskPenalty * voteWeight;
          accumulator.confidenceWeight += voteWeight;
          accumulator.supportingStrategies.push(vote.strategyId);
        } else {
          opposingWeight += voteWeight;
          accumulator.opposeVotes += 1;
          accumulator.opposeWeight += voteWeight;
          accumulator.opposingStrategies.push(vote.strategyId);
        }
      }

      const targetScores = Array.from(targets.values()).map(accumulator => this.toTargetScore(accumulator));
      targetScores.sort((left, right) => {
        const byConsensus = right.consensusScore - left.consensusScore;
        if (byConsensus !== 0) return byConsensus;
        const byConflict = left.conflictScore - right.conflictScore;
        if (byConflict !== 0) return byConflict;
        return left.targetId.localeCompare(right.targetId);
      });

      const selectedTarget = targetScores.length > 0 ? targetScores[0] : null;
      const blockers = this.blockers(selectedTarget, blockedWeight);
      const warnings = this.warnings(selectedTarget, abstainWeight, targetScores);
      const decision = this.decision(selectedTarget, blockers);

      return ok({
        engineVersion: 'strategy-ensemble-v1',
        voteCount: votes.length,
        activeVoteCount: targetScores.reduce((total, target) => total + target.supportVotes + target.opposeVotes, 0),
        decision,
        selectedTarget,
        targets: targetScores,
        supportWeight: round(supportWeight),
        opposingWeight: round(opposingWeight),
        abstainWeight: round(abstainWeight),
        blockedWeight: round(blockedWeight),
        blockers,
        warnings
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown_strategy_ensemble_error';
      return err(new DomainError(message, 'STRATEGY_ENSEMBLE_FAILED'));
    }
  }

  private getAccumulator(targets: Map<string, MutableTargetAccumulator>, vote: StrategyEnsembleVote): MutableTargetAccumulator {
    const existing = targets.get(vote.targetId);
    if (existing) return existing;

    const accumulator: MutableTargetAccumulator = {
      targetId: vote.targetId,
      targetLabel: vote.targetLabel,
      supportVotes: 0,
      opposeVotes: 0,
      supportWeight: 0,
      opposeWeight: 0,
      confidenceWeightedSum: 0,
      evidenceWeightedSum: 0,
      riskWeightedSum: 0,
      confidenceWeight: 0,
      supportingStrategies: [],
      opposingStrategies: []
    };
    targets.set(vote.targetId, accumulator);
    return accumulator;
  }

  private toTargetScore(accumulator: MutableTargetAccumulator): StrategyEnsembleTargetScore {
    const totalDirectionalWeight = accumulator.supportWeight + accumulator.opposeWeight;
    const averageConfidence = accumulator.confidenceWeight > 0 ? accumulator.confidenceWeightedSum / accumulator.confidenceWeight : 0;
    const averageEvidenceScore = accumulator.confidenceWeight > 0 ? accumulator.evidenceWeightedSum / accumulator.confidenceWeight : 0;
    const averageRiskPenalty = accumulator.confidenceWeight > 0 ? accumulator.riskWeightedSum / accumulator.confidenceWeight : 1;
    const supportDominance = totalDirectionalWeight > 0 ? accumulator.supportWeight / totalDirectionalWeight : 0;
    const riskAdjustedSupport = supportDominance * (1 - averageRiskPenalty);
    const consensusScore = clamp(riskAdjustedSupport * 0.54 + averageConfidence * 0.23 + averageEvidenceScore * 0.23);
    const conflictScore = totalDirectionalWeight > 0 ? clamp(accumulator.opposeWeight / totalDirectionalWeight) : 1;

    return {
      targetId: accumulator.targetId,
      targetLabel: accumulator.targetLabel,
      supportVotes: accumulator.supportVotes,
      opposeVotes: accumulator.opposeVotes,
      supportWeight: round(accumulator.supportWeight),
      opposeWeight: round(accumulator.opposeWeight),
      averageConfidence: round(averageConfidence),
      averageEvidenceScore: round(averageEvidenceScore),
      averageRiskPenalty: round(averageRiskPenalty),
      consensusScore: round(consensusScore),
      conflictScore: round(conflictScore),
      supportingStrategies: [...accumulator.supportingStrategies].sort(),
      opposingStrategies: [...accumulator.opposingStrategies].sort()
    };
  }

  private decision(selectedTarget: StrategyEnsembleTargetScore | null, blockers: readonly string[]): StrategyEnsembleDecision {
    if (blockers.some(blocker => blocker.includes('bloqueada'))) return 'BLOCKED';
    if (!selectedTarget) return 'INSUFFICIENT_SUPPORT';
    if (selectedTarget.conflictScore > this.options.maxConflictScore) return 'CONFLICT';
    if (blockers.length > 0) return 'INSUFFICIENT_SUPPORT';
    return 'CONSENSUS';
  }

  private blockers(selectedTarget: StrategyEnsembleTargetScore | null, blockedWeight: number): readonly string[] {
    const blockers: string[] = [];
    if (blockedWeight >= this.options.minSupportWeight) blockers.push('Peso bloqueado por estratégias vetadas excede limite do ensemble.');
    if (!selectedTarget) {
      blockers.push('Nenhum alvo recebeu votos direcionais suficientes para formar ensemble.');
      return blockers;
    }
    if (selectedTarget.supportVotes < this.options.minSupportVotes) blockers.push('Quantidade de votos de suporte abaixo do mínimo do ensemble.');
    if (selectedTarget.supportWeight < this.options.minSupportWeight) blockers.push('Peso de suporte abaixo do mínimo do ensemble.');
    if (selectedTarget.consensusScore < this.options.minConsensusScore) blockers.push('Score de consenso abaixo do limiar institucional.');
    if (selectedTarget.averageRiskPenalty > this.options.maxAverageRiskPenalty) blockers.push('Risco médio do alvo excede limite do ensemble.');
    if (selectedTarget.conflictScore > this.options.maxConflictScore) blockers.push('Conflito entre estratégias excede limite do ensemble.');
    return blockers;
  }

  private warnings(
    selectedTarget: StrategyEnsembleTargetScore | null,
    abstainWeight: number,
    targets: readonly StrategyEnsembleTargetScore[]
  ): readonly string[] {
    const warnings: string[] = [];
    if (abstainWeight > 0) warnings.push('Parte das estratégias optou por abstenção, reduzindo convicção agregada.');
    if (targets.length > 1) warnings.push('Mais de um alvo recebeu votos; arbitragem por consenso foi aplicada.');
    if (selectedTarget && selectedTarget.opposeVotes > 0) warnings.push('Alvo selecionado possui oposição explícita de ao menos uma estratégia.');
    return warnings;
  }

  private voteWeight(vote: StrategyEnsembleVote): number {
    return round(clamp(vote.weight) * clamp(vote.recencyWeight));
  }

  private validateOptions(options: StrategyEnsembleOptions): void {
    if (!Number.isInteger(options.minSupportVotes) || options.minSupportVotes < 1) throw new Error('invalid_ensemble_min_support_votes');
    if (!isUnit(options.minConsensusScore)) throw new Error('invalid_ensemble_min_consensus_score');
    if (!isUnit(options.maxConflictScore)) throw new Error('invalid_ensemble_max_conflict_score');
    if (!isUnit(options.minSupportWeight)) throw new Error('invalid_ensemble_min_support_weight');
    if (!isUnit(options.maxAverageRiskPenalty)) throw new Error('invalid_ensemble_max_average_risk_penalty');
  }

  private validateVote(vote: StrategyEnsembleVote): void {
    if (!vote.strategyId.trim()) throw new Error('invalid_ensemble_vote_strategy_id');
    if (!vote.label.trim()) throw new Error('invalid_ensemble_vote_label');
    if (!vote.targetId.trim()) throw new Error('invalid_ensemble_vote_target_id');
    if (!vote.targetLabel.trim()) throw new Error('invalid_ensemble_vote_target_label');
    if (!isUnit(vote.confidence)) throw new Error('invalid_ensemble_vote_confidence');
    if (!isUnit(vote.evidenceScore)) throw new Error('invalid_ensemble_vote_evidence_score');
    if (!isUnit(vote.riskPenalty)) throw new Error('invalid_ensemble_vote_risk_penalty');
    if (!isUnit(vote.recencyWeight)) throw new Error('invalid_ensemble_vote_recency_weight');
    if (!isUnit(vote.weight)) throw new Error('invalid_ensemble_vote_weight');
  }
}

function isUnit(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function round(value: number): number {
  return Number(value.toFixed(6));
}
