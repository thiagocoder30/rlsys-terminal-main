import {
  TriplicacaoAdvancedProbabilityEngine,
  type TriplicacaoAdvancedProbabilityAnalysis,
} from '../../domain/analytics/TriplicacaoAdvancedProbabilityEngine.js';

import {
  FusionHeatmapIntegrationEngine,
  type FusionHeatmapIntegrationReport,
} from './FusionHeatmapIntegrationEngine.js';


export type PaperOracleArenaStrategyId =
  | 'triplicacao'
  | 'fusion-reduzida';


export type PaperOracleArenaCandidateStatus =
  | 'CANDIDATE'
  | 'NONE'
  | 'BLOCKED';


export type PaperOracleArenaDecision =
  | 'CANDIDATE'
  | 'OBSERVE'
  | 'BLOCKED';


export type PaperOracleArenaTarget =
  | {
      readonly kind:
        'PATTERN';

      readonly id:
        string;

      readonly label:
        string;

      readonly numbers:
        readonly number[];
    }
  | {
      readonly kind:
        'REGION';

      readonly id:
        string;

      readonly label:
        string;

      readonly numbers:
        readonly number[];
    };


export interface PaperOracleArenaTriplicacaoPort {
  analyze(
    history:
      readonly number[],
  ): TriplicacaoAdvancedProbabilityAnalysis;
}


export interface PaperOracleArenaFusionPort {
  analyze(
    history:
      readonly number[],
  ): FusionHeatmapIntegrationReport;
}


export interface PaperOracleArenaCandidate {
  readonly strategyId:
    PaperOracleArenaStrategyId;

  readonly label:
    string;

  readonly status:
    PaperOracleArenaCandidateStatus;

  readonly confidenceScore:
    number;

  readonly evidenceScore:
    number;

  readonly riskScore:
    number;

  readonly riskProtectionScore:
    number;

  readonly opportunityScore:
    number;

  readonly target:
    PaperOracleArenaTarget | null;

  readonly reasons:
    readonly string[];

  readonly warnings:
    readonly string[];

  readonly blockers:
    readonly string[];

  readonly paperOnly:
    true;

  readonly liveMoneyAuthorization:
    false;

  readonly automaticBetExecutionAllowed:
    false;
}


export interface PaperOracleStrategyArenaReport {
  readonly decision:
    PaperOracleArenaDecision;

  readonly historySize:
    number;

  readonly winner:
    PaperOracleArenaCandidate | null;

  readonly ranking:
    readonly PaperOracleArenaCandidate[];

  readonly candidates:
    readonly PaperOracleArenaCandidate[];

  readonly triplicacao:
    TriplicacaoAdvancedProbabilityAnalysis;

  readonly fusion:
    FusionHeatmapIntegrationReport;

  readonly candidateCount:
    number;

  readonly blockedCount:
    number;

  readonly reasons:
    readonly string[];

  readonly warnings:
    readonly string[];

  readonly paperOnly:
    true;

  readonly liveMoneyAuthorization:
    false;

  readonly automaticBetExecutionAllowed:
    false;

  readonly operatorDecisionRequired:
    true;
}


/**
 * Independent strategy arena for the PAPER oracle.
 *
 * Each strategy owns its own hypothesis and its own readiness rules.
 *
 * Triplicação does NOT need Fusion approval.
 * Fusion does NOT need Triplicação approval.
 *
 * Arena behavior:
 *
 * 0 candidates:
 *   OBSERVE
 *
 * 1 candidate:
 *   candidate wins directly
 *
 * 2+ candidates:
 *   candidates are ranked by current opportunity quality
 *
 * A BLOCKED strategy does not veto another valid strategy.
 *
 * Only when every participating strategy is BLOCKED does the arena
 * itself become BLOCKED.
 *
 * Current opportunity score:
 *
 *   geometric mean(
 *     confidence,
 *     evidence,
 *     1 - risk
 *   )
 *
 * This makes the weakest dimension materially constrain the score,
 * rather than allowing high confidence to hide high risk.
 *
 * This class does NOT resolve a betting direction and does NOT
 * execute any bet.
 */
export class PaperOracleStrategyArena {
  public constructor(
    private readonly triplicacao:
      PaperOracleArenaTriplicacaoPort =
        new TriplicacaoAdvancedProbabilityEngine(),

    private readonly fusion:
      PaperOracleArenaFusionPort =
        new FusionHeatmapIntegrationEngine(),
  ) {}


  public analyze(
    history:
      readonly number[],
  ): PaperOracleStrategyArenaReport {
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

    const triplicacaoCandidate =
      this.fromTriplicacao(
        triplicacao,
      );

    const fusionCandidate =
      this.fromFusion(
        fusion,
      );

    const participants =
      Object.freeze([
        triplicacaoCandidate,
        fusionCandidate,
      ]);

    const candidates =
      participants.filter(
        (candidate) =>
          candidate.status ===
          'CANDIDATE',
      );

    const blocked =
      participants.filter(
        (candidate) =>
          candidate.status ===
          'BLOCKED',
      );

    const ranking =
      Object.freeze(
        [...candidates]
          .sort(
            (left, right) => {
              const scoreDifference =
                right.opportunityScore -
                left.opportunityScore;

              if (
                scoreDifference !== 0
              ) {
                return scoreDifference;
              }

              const confidenceDifference =
                right.confidenceScore -
                left.confidenceScore;

              if (
                confidenceDifference !==
                0
              ) {
                return confidenceDifference;
              }

              const riskDifference =
                left.riskScore -
                right.riskScore;

              if (
                riskDifference !== 0
              ) {
                return riskDifference;
              }

              return left.strategyId
                .localeCompare(
                  right.strategyId,
                );
            },
          ),
      );

    const winner =
      ranking[0] ??
      null;

    const decision =
      this.resolveDecision({
        candidateCount:
          candidates.length,

        blockedCount:
          blocked.length,

        participantCount:
          participants.length,
      });

    return Object.freeze({
      decision,

      historySize:
        normalized.length,

      winner,

      ranking,

      candidates:
        participants,

      triplicacao,

      fusion,

      candidateCount:
        candidates.length,

      blockedCount:
        blocked.length,

      reasons:
        Object.freeze([
          `ARENA_DECISION:${decision}`,
          `ARENA_CANDIDATES:${candidates.length}`,
          `ARENA_BLOCKED:${blocked.length}`,

          `TRIPLICACAO_STATUS:${triplicacaoCandidate.status}`,
          `TRIPLICACAO_SCORE:${triplicacaoCandidate.opportunityScore}`,

          `FUSION_STATUS:${fusionCandidate.status}`,
          `FUSION_SCORE:${fusionCandidate.opportunityScore}`,

          ...(winner
            ? [
                `ARENA_WINNER:${winner.strategyId}`,
                `ARENA_WINNER_SCORE:${winner.opportunityScore}`,
              ]
            : []),
        ]),

      warnings:
        Object.freeze([
          ...this.prefixMessages(
            'TRIPLICACAO',
            triplicacaoCandidate.warnings,
          ),

          ...this.prefixMessages(
            'FUSION',
            fusionCandidate.warnings,
          ),
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


  private fromTriplicacao(
    report:
      TriplicacaoAdvancedProbabilityAnalysis,
  ): PaperOracleArenaCandidate {
    const confidence =
      this.clampRatio(
        report.advancedConfidenceScore,
      );

    const evidence =
      this.clampRatio(
        report.advancedEvidenceScore /
        100,
      );

    const risk =
      this.clampRatio(
        report.advancedRiskScore,
      );

    let status:
      PaperOracleArenaCandidateStatus;

    if (
      report.probabilityMode ===
        'PAPER_ONLY' &&
      report.blockers.length === 0
    ) {
      status =
        'CANDIDATE';
    } else if (
      risk >= 0.67
    ) {
      status =
        'BLOCKED';
    } else {
      status =
        'NONE';
    }

    const target:
      PaperOracleArenaTarget | null =
      report.selectedPatternKind ===
      null
        ? null
        : Object.freeze({
            kind:
              'PATTERN' as const,

            id:
              `TRIPLICACAO_PATTERN_${report.selectedPatternKind}`,

            label:
              `Padrão ${report.selectedPatternKind}`,

            /*
             * A Triplicação Advanced atualmente identifica
             * TC/NTC/TA/NTA, não uma aposta RED/BLACK/EVEN/ODD.
             *
             * Não inventamos números ou direção aqui.
             */
            numbers:
              Object.freeze([]),
          });

    return this.candidate({
      strategyId:
        'triplicacao',

      label:
        'Triplicação Advanced',

      status,

      confidence,

      evidence,

      risk,

      target,

      reasons:
        Object.freeze([
          ...report.reasons,

          `TRIPLICACAO_MODE:${report.probabilityMode}`,

          ...(report.selectedPatternKind
            ? [
                `TRIPLICACAO_SELECTED_PATTERN:${report.selectedPatternKind}`,
              ]
            : []),
        ]),

      warnings:
        report.warnings,

      blockers:
        report.blockers,
    });
  }


  private fromFusion(
    report:
      FusionHeatmapIntegrationReport,
  ): PaperOracleArenaCandidate {
    const confidence =
      this.clampRatio(
        report.fusionConfidenceScore,
      );

    const evidence =
      this.clampRatio(
        report.fusionPressureScore /
        100,
      );

    const risk =
      this.clampRatio(
        report.fusionRiskScore,
      );

    let status:
      PaperOracleArenaCandidateStatus;

    if (
      report.mode ===
        'FUSION_READY' &&
      report.blockers.length === 0
    ) {
      status =
        'CANDIDATE';
    } else if (
      risk >= 0.67 ||
      report.blockers.some(
        (blocker) =>
          blocker.includes(
            'RISK_TOO_HIGH',
          ),
      )
    ) {
      status =
        'BLOCKED';
    } else {
      status =
        'NONE';
    }

    const topRegion =
      report.targetRegions[0] ??
      null;

    const target:
      PaperOracleArenaTarget | null =
      topRegion ===
      null
        ? null
        : Object.freeze({
            kind:
              'REGION' as const,

            id:
              topRegion.regionId,

            label:
              topRegion.regionId,

            numbers:
              Object.freeze([
                ...topRegion.numbers,
              ]),
          });

    return this.candidate({
      strategyId:
        'fusion-reduzida',

      label:
        'Fusion Reduzida',

      status,

      confidence,

      evidence,

      risk,

      target,

      reasons:
        Object.freeze([
          ...report.reasons,

          `FUSION_MODE:${report.mode}`,

          `FUSION_SIGNAL:${report.signalStrength}`,

          ...(topRegion
            ? [
                `FUSION_TOP_REGION:${topRegion.regionId}`,
              ]
            : []),
        ]),

      warnings:
        report.warnings,

      blockers:
        report.blockers,
    });
  }


  private candidate(
    input: {
      readonly strategyId:
        PaperOracleArenaStrategyId;

      readonly label:
        string;

      readonly status:
        PaperOracleArenaCandidateStatus;

      readonly confidence:
        number;

      readonly evidence:
        number;

      readonly risk:
        number;

      readonly target:
        PaperOracleArenaTarget | null;

      readonly reasons:
        readonly string[];

      readonly warnings:
        readonly string[];

      readonly blockers:
        readonly string[];
    },
  ): PaperOracleArenaCandidate {
    const confidence =
      this.clampRatio(
        input.confidence,
      );

    const evidence =
      this.clampRatio(
        input.evidence,
      );

    const risk =
      this.clampRatio(
        input.risk,
      );

    const riskProtection =
      this.clampRatio(
        1 -
        risk,
      );

    const opportunityScore =
      input.status ===
      'CANDIDATE'
        ? this.geometricOpportunityScore({
            confidence,
            evidence,
            riskProtection,
          })
        : 0;

    return Object.freeze({
      strategyId:
        input.strategyId,

      label:
        input.label,

      status:
        input.status,

      confidenceScore:
        confidence,

      evidenceScore:
        evidence,

      riskScore:
        risk,

      riskProtectionScore:
        riskProtection,

      opportunityScore,

      target:
        input.target,

      reasons:
        Object.freeze([
          ...input.reasons,
        ]),

      warnings:
        Object.freeze([
          ...input.warnings,
        ]),

      blockers:
        Object.freeze([
          ...input.blockers,
        ]),

      paperOnly:
        true as const,

      liveMoneyAuthorization:
        false as const,

      automaticBetExecutionAllowed:
        false as const,
    });
  }


  private geometricOpportunityScore(
    input: {
      readonly confidence:
        number;

      readonly evidence:
        number;

      readonly riskProtection:
        number;
    },
  ): number {
    const product =
      input.confidence *
      input.evidence *
      input.riskProtection;

    if (
      product <= 0
    ) {
      return 0;
    }

    return this.round6(
      Math.cbrt(
        product,
      ),
    );
  }


  private resolveDecision(
    input: {
      readonly candidateCount:
        number;

      readonly blockedCount:
        number;

      readonly participantCount:
        number;
    },
  ): PaperOracleArenaDecision {
    /*
     * Any valid strategy opportunity wins over a block belonging
     * to a different independent strategy.
     *
     * Example:
     *
     * Triplicação = CANDIDATE
     * Fusion      = BLOCKED
     *
     * Arena       = CANDIDATE
     *
     * Fusion does not veto Triplicação.
     */
    if (
      input.candidateCount > 0
    ) {
      return 'CANDIDATE';
    }

    /*
     * Arena-level BLOCKED exists only when every participating
     * strategy independently blocks itself.
     */
    if (
      input.blockedCount ===
      input.participantCount
    ) {
      return 'BLOCKED';
    }

    return 'OBSERVE';
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
        'paper_oracle_strategy_arena_history_required',
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
          'paper_oracle_strategy_arena_invalid_spin',
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


  private round6(
    value:
      number,
  ): number {
    return Number(
      value.toFixed(
        6,
      ),
    );
  }
}
