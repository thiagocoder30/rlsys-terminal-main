import {
  TriplicacaoAdvancedProbabilityEngine,
  type TriplicacaoAdvancedProbabilityAnalysis,
} from '../../domain/analytics/TriplicacaoAdvancedProbabilityEngine.js';

import {
  FusionHeatmapIntegrationEngine,
  type FusionHeatmapIntegrationReport,
} from './FusionHeatmapIntegrationEngine.js';

import {
  StrategyEnsembleEngine,
  type StrategyEnsembleReport,
  type StrategyEnsembleVote,
} from '../../domain/strategy/StrategyEnsembleEngine.js';


export type PaperOracleEnsembleStrategyId =
  | 'triplicacao'
  | 'fusion-reduzida';


export type PaperOracleEnsembleContextDecision =
  | 'CONSENSUS_READY'
  | 'OBSERVE'
  | 'BLOCKED'
  | 'CONFLICT';


export interface PaperOracleTriplicacaoPort {
  analyze(
    history: readonly number[],
  ): TriplicacaoAdvancedProbabilityAnalysis;
}


export interface PaperOracleFusionPort {
  analyze(
    history: readonly number[],
  ): FusionHeatmapIntegrationReport;
}


export interface PaperOracleEnsemblePort {
  evaluate(
    votes: readonly StrategyEnsembleVote[],
  ):
    | {
        readonly success: true;
        readonly value: StrategyEnsembleReport;
      }
    | {
        readonly success: false;
        readonly error: {
          readonly message: string;
        };
      };
}


export interface PaperOracleStrategyAssessment {
  readonly strategyId:
    PaperOracleEnsembleStrategyId;

  readonly label:
    string;

  readonly voteStatus:
    StrategyEnsembleVote['status'];

  readonly confidenceScore:
    number;

  readonly evidenceScore:
    number;

  readonly riskScore:
    number;

  readonly reasons:
    readonly string[];

  readonly warnings:
    readonly string[];

  readonly blockers:
    readonly string[];
}


export interface PaperOracleStrategyEnsembleReport {
  readonly decision:
    PaperOracleEnsembleContextDecision;

  readonly historySize:
    number;

  readonly assessments:
    readonly PaperOracleStrategyAssessment[];

  readonly votes:
    readonly StrategyEnsembleVote[];

  readonly ensemble:
    StrategyEnsembleReport;

  readonly triplicacao:
    TriplicacaoAdvancedProbabilityAnalysis;

  readonly fusion:
    FusionHeatmapIntegrationReport;

  readonly consensusReady:
    boolean;

  readonly reasons:
    readonly string[];

  readonly warnings:
    readonly string[];

  readonly blockers:
    readonly string[];

  readonly paperOnly: true;

  readonly liveMoneyAuthorization: false;

  readonly automaticBetExecutionAllowed: false;

  readonly operatorDecisionRequired: true;
}


/**
 * Canonical multi-strategy runtime for the PAPER oracle.
 *
 * Current participants:
 *
 * - Triplicação Advanced Probability
 * - Fusion Heatmap
 *
 * Both vote about the same institutional hypothesis:
 *
 *   PAPER_CONTEXT
 *
 * A strategy-level BLOCKED vote is treated as authoritative
 * for the PAPER oracle, even if the generic StrategyEnsembleEngine
 * reduces the aggregate result to INSUFFICIENT_SUPPORT.
 *
 * This is intentional fail-closed behavior.
 */
export class PaperOracleStrategyEnsembleRuntime {
  public constructor(
    private readonly triplicacao:
      PaperOracleTriplicacaoPort =
        new TriplicacaoAdvancedProbabilityEngine(),

    private readonly fusion:
      PaperOracleFusionPort =
        new FusionHeatmapIntegrationEngine(),

    private readonly ensemble:
      PaperOracleEnsemblePort =
        new StrategyEnsembleEngine(),
  ) {}


  public analyze(
    history:
      readonly number[],
  ): PaperOracleStrategyEnsembleReport {
    const normalized =
      this.normalizeHistory(
        history,
      );

    const triplicacao =
      this.triplicacao.analyze(
        normalized,
      );

    const fusion =
      this.fusion.analyze(
        normalized,
      );

    const triplicacaoAssessment =
      this.assessTriplicacao(
        triplicacao,
      );

    const fusionAssessment =
      this.assessFusion(
        fusion,
      );

    const assessments =
      Object.freeze([
        triplicacaoAssessment,
        fusionAssessment,
      ]);

    const votes =
      Object.freeze(
        assessments.map(
          (assessment) =>
            this.toVote(
              assessment,
            ),
        ),
      );

    const ensembleResult =
      this.ensemble.evaluate(
        votes,
      );

    if (
      !ensembleResult.success
    ) {
      throw new Error(
        `paper_oracle_strategy_ensemble_failed:${ensembleResult.error.message}`,
      );
    }

    const ensemble =
      ensembleResult.value;

    const decision =
      this.resolveDecision(
        ensemble,
        assessments,
      );

    const strategyBlockers =
      this.criticalBlockers(
        triplicacaoAssessment,
        fusionAssessment,
      );

    return Object.freeze({
      decision,

      historySize:
        normalized.length,

      assessments,

      votes,

      ensemble,

      triplicacao,

      fusion,

      consensusReady:
        decision ===
        'CONSENSUS_READY',

      reasons:
        Object.freeze([
          `ENSEMBLE_DECISION:${ensemble.decision}`,
          `ENSEMBLE_ACTIVE_VOTES:${ensemble.activeVoteCount}`,
          `TRIPLICACAO_VOTE:${triplicacaoAssessment.voteStatus}`,
          `FUSION_VOTE:${fusionAssessment.voteStatus}`,

          ...(decision ===
          'BLOCKED'
            ? [
                'PAPER_ORACLE_FAIL_CLOSED_STRATEGY_BLOCK',
              ]
            : []),

          ...(ensemble.selectedTarget
            ? [
                `ENSEMBLE_CONSENSUS_SCORE:${ensemble.selectedTarget.consensusScore}`,
                `ENSEMBLE_SUPPORT_VOTES:${ensemble.selectedTarget.supportVotes}`,
              ]
            : []),
        ]),

      warnings:
        Object.freeze([
          ...ensemble.warnings,

          ...this.prefixMessages(
            'TRIPLICACAO',
            triplicacaoAssessment.warnings,
          ),

          ...this.prefixMessages(
            'FUSION',
            fusionAssessment.warnings,
          ),
        ]),

      blockers:
        Object.freeze([
          ...ensemble.blockers,
          ...strategyBlockers,
        ]),

      paperOnly:
        true as const,

      liveMoneyAuthorization:
        false as const,

      automaticBetExecutionAllowed:
        false as const,

      operatorDecisionRequired:
        true as const,
    });
  }


  private assessTriplicacao(
    report:
      TriplicacaoAdvancedProbabilityAnalysis,
  ): PaperOracleStrategyAssessment {
    const risk =
      this.clampRatio(
        report.advancedRiskScore,
      );

    const confidence =
      this.clampRatio(
        report.advancedConfidenceScore,
      );

    const evidence =
      this.clampRatio(
        report.advancedEvidenceScore /
        100,
      );

    let voteStatus:
      StrategyEnsembleVote['status'];

    if (
      report.probabilityMode ===
        'PAPER_ONLY' &&
      report.blockers.length === 0 &&
      risk <= 0.48
    ) {
      voteStatus =
        'SUPPORT';
    } else if (
      risk >= 0.67
    ) {
      voteStatus =
        'BLOCKED';
    } else {
      voteStatus =
        'ABSTAIN';
    }

    return Object.freeze({
      strategyId:
        'triplicacao' as const,

      label:
        'Triplicação Advanced',

      voteStatus,

      confidenceScore:
        confidence,

      evidenceScore:
        evidence,

      riskScore:
        risk,

      reasons:
        Object.freeze([
          ...report.reasons,

          ...(report.selectedPatternKind
            ? [
                `SELECTED_PATTERN:${report.selectedPatternKind}`,
              ]
            : []),
        ]),

      warnings:
        Object.freeze([
          ...report.warnings,
        ]),

      blockers:
        Object.freeze([
          ...report.blockers,
        ]),
    });
  }


  private assessFusion(
    report:
      FusionHeatmapIntegrationReport,
  ): PaperOracleStrategyAssessment {
    const risk =
      this.clampRatio(
        report.fusionRiskScore,
      );

    const confidence =
      this.clampRatio(
        report.fusionConfidenceScore,
      );

    const evidence =
      this.clampRatio(
        report.fusionPressureScore /
        100,
      );

    let voteStatus:
      StrategyEnsembleVote['status'];

    if (
      report.mode ===
        'FUSION_READY' &&
      report.blockers.length === 0 &&
      risk <= 0.48
    ) {
      voteStatus =
        'SUPPORT';
    } else if (
      risk >= 0.67 ||
      report.blockers.some(
        (blocker) =>
          blocker.includes(
            'RISK_TOO_HIGH',
          ),
      )
    ) {
      voteStatus =
        'BLOCKED';
    } else {
      voteStatus =
        'ABSTAIN';
    }

    return Object.freeze({
      strategyId:
        'fusion-reduzida' as const,

      label:
        'Fusion Reduzida',

      voteStatus,

      confidenceScore:
        confidence,

      evidenceScore:
        evidence,

      riskScore:
        risk,

      reasons:
        Object.freeze([
          ...report.reasons,

          `FUSION_SIGNAL_STRENGTH:${report.signalStrength}`,

          `FUSION_TARGET_REGION_COUNT:${report.targetRegions.length}`,
        ]),

      warnings:
        Object.freeze([
          ...report.warnings,
        ]),

      blockers:
        Object.freeze([
          ...report.blockers,
        ]),
    });
  }


  private toVote(
    assessment:
      PaperOracleStrategyAssessment,
  ): StrategyEnsembleVote {
    return Object.freeze({
      strategyId:
        assessment.strategyId,

      label:
        assessment.label,

      status:
        assessment.voteStatus,

      targetId:
        'PAPER_CONTEXT',

      targetLabel:
        'Contexto PAPER Favorável',

      confidence:
        assessment.confidenceScore,

      evidenceScore:
        assessment.evidenceScore,

      riskPenalty:
        assessment.riskScore,

      recencyWeight:
        1,

      weight:
        1,
    });
  }


  private resolveDecision(
    ensemble:
      StrategyEnsembleReport,

    assessments:
      readonly PaperOracleStrategyAssessment[],
  ): PaperOracleEnsembleContextDecision {
    /*
     * Fail closed at the PAPER application boundary.
     *
     * The generic domain StrategyEnsembleEngine currently may classify
     * blocked strategy weight as INSUFFICIENT_SUPPORT. For the PAPER
     * oracle, an explicit strategy BLOCKED vote must never degrade into
     * simple observation.
     */
    if (
      assessments.some(
        (assessment) =>
          assessment.voteStatus ===
          'BLOCKED',
      )
    ) {
      return 'BLOCKED';
    }

    if (
      ensemble.decision ===
      'CONSENSUS'
    ) {
      return 'CONSENSUS_READY';
    }

    if (
      ensemble.decision ===
      'BLOCKED'
    ) {
      return 'BLOCKED';
    }

    if (
      ensemble.decision ===
      'CONFLICT'
    ) {
      return 'CONFLICT';
    }

    return 'OBSERVE';
  }


  private criticalBlockers(
    triplicacao:
      PaperOracleStrategyAssessment,

    fusion:
      PaperOracleStrategyAssessment,
  ): readonly string[] {
    const blockers:
      string[] = [];

    if (
      triplicacao.voteStatus ===
      'BLOCKED'
    ) {
      blockers.push(
        ...this.prefixMessages(
          'TRIPLICACAO',

          triplicacao.blockers.length > 0
            ? triplicacao.blockers
            : [
                'STRATEGY_RISK_BLOCKED',
              ],
        ),
      );
    }

    if (
      fusion.voteStatus ===
      'BLOCKED'
    ) {
      blockers.push(
        ...this.prefixMessages(
          'FUSION',

          fusion.blockers.length > 0
            ? fusion.blockers
            : [
                'STRATEGY_RISK_BLOCKED',
              ],
        ),
      );
    }

    return Object.freeze(
      blockers,
    );
  }


  private prefixMessages(
    prefix:
      string,

    messages:
      readonly string[],
  ): readonly string[] {
    return Object.freeze(
      messages.map(
        (message) =>
          `${prefix}:${message}`,
      ),
    );
  }


  private normalizeHistory(
    history:
      readonly number[],
  ): number[] {
    if (
      !Array.isArray(
        history,
      ) ||
      history.length === 0
    ) {
      throw new Error(
        'paper_oracle_strategy_ensemble_history_required',
      );
    }

    const normalized:
      number[] = [];

    for (
      const spin of history
    ) {
      if (
        !Number.isInteger(
          spin,
        ) ||
        spin < 0 ||
        spin > 36
      ) {
        throw new Error(
          'paper_oracle_strategy_ensemble_invalid_spin',
        );
      }

      normalized.push(
        spin,
      );
    }

    return normalized;
  }


  private clampRatio(
    value:
      number,
  ): number {
    if (
      !Number.isFinite(
        value,
      )
    ) {
      return 0;
    }

    return Math.max(
      0,
      Math.min(
        1,
        value,
      ),
    );
  }
}
