import {
  FusionReducedDoctrineEngine,
  type FusionReducedDoctrineSnapshot,
} from './FusionReducedDoctrineEngine.js';

import type {
  FusionReducedEvidence,
} from './FusionReducedProspectiveDecisionSemantics.js';


export interface FusionReducedEvidenceOptions {
  /**
   * Duas voltas completas de uma roda europeia.
   */
  readonly minimumSampleSize?:
    number;

  /**
   * Janela de curto prazo usada somente como evidência empírica.
   */
  readonly recentWindowSize?:
    number;

  /**
   * Frequência global mínima observada no alvo fixo.
   */
  readonly minimumOverallHitRate?:
    number;

  /**
   * Frequência recente mínima observada no alvo fixo.
   */
  readonly minimumRecentHitRate?:
    number;

  /**
   * Diferença máxima entre taxa global e recente.
   *
   * Evita classificar como estável um recorte excessivamente
   * diferente do histórico maior.
   */
  readonly maximumRateDrift?:
    number;
}


export interface FusionReducedEvidenceReport
  extends FusionReducedEvidence {

  readonly strategyId:
    'fusion-reduced';

  readonly sampleSize:
    number;

  readonly recentSampleSize:
    number;

  readonly targetSize:
    19;

  readonly expectedCoverageRate:
    number;

  readonly observedHitCount:
    number;

  readonly observedMissCount:
    number;

  readonly observedHitRate:
    number;

  readonly recentHitCount:
    number;

  readonly recentMissCount:
    number;

  readonly recentHitRate:
    number;

  readonly rateDrift:
    number;

  readonly sampleAdequacy:
    number;

  readonly targetNumbers:
    readonly number[];

  readonly paperOnly:
    true;

  readonly recommendationOnly:
    true;

  readonly automaticExecutionAllowed:
    false;
}


interface ResolvedFusionReducedEvidenceOptions {
  readonly minimumSampleSize:
    number;

  readonly recentWindowSize:
    number;

  readonly minimumOverallHitRate:
    number;

  readonly minimumRecentHitRate:
    number;

  readonly maximumRateDrift:
    number;
}


const DEFAULT_OPTIONS:
  ResolvedFusionReducedEvidenceOptions =
  Object.freeze({
    minimumSampleSize:
      74,

    recentWindowSize:
      24,

    minimumOverallHitRate:
      0.52,

    minimumRecentHitRate:
      0.54,

    maximumRateDrift:
      0.15,
  });


/**
 * Empirical evidence engine for FUSION REDUZIDA.
 *
 * IMPORTANT:
 *
 * This engine does NOT claim that roulette history predicts
 * the next spin.
 *
 * It only creates a reproducible PAPER trigger that can later
 * be evaluated prospectively.
 *
 * Target identity is never calculated here.
 * It comes exclusively from FusionReducedDoctrineEngine:
 *
 * center 23
 * 9 left neighbors
 * 9 right neighbors
 * total 19 numbers
 */
export class FusionReducedEvidenceEngine {
  private readonly doctrine:
    FusionReducedDoctrineSnapshot;


  public constructor(
    doctrine:
      FusionReducedDoctrineSnapshot =
        new FusionReducedDoctrineEngine()
          .snapshot(),
  ) {
    this.doctrine =
      doctrine;
  }


  public analyze(
    history:
      readonly number[],

    options:
      FusionReducedEvidenceOptions = {},
  ): FusionReducedEvidenceReport {
    this.validateHistory(
      history,
    );

    const resolved =
      this.resolveOptions(
        options,
      );

    const target =
      new Set(
        this.doctrine
          .targetNumbers,
      );

    const sampleSize =
      history.length;

    const observedHitCount =
      this.hitCount(
        history,
        target,
      );

    const observedMissCount =
      sampleSize -
      observedHitCount;

    const observedHitRate =
      this.rate(
        observedHitCount,
        sampleSize,
      );

    const recentHistory =
      history.slice(
        Math.max(
          0,
          history.length -
          resolved.recentWindowSize,
        ),
      );

    const recentSampleSize =
      recentHistory.length;

    const recentHitCount =
      this.hitCount(
        recentHistory,
        target,
      );

    const recentMissCount =
      recentSampleSize -
      recentHitCount;

    const recentHitRate =
      this.rate(
        recentHitCount,
        recentSampleSize,
      );

    const rateDrift =
      Math.abs(
        observedHitRate -
        recentHitRate,
      );

    const sampleAdequacy =
      Math.min(
        1,
        sampleSize /
        resolved.minimumSampleSize,
      );

    const blockers:
      string[] =
      [];

    const warnings:
      string[] =
      [];

    const reasons:
      string[] =
      [];


    if (
      sampleSize <
      resolved.minimumSampleSize
    ) {
      blockers.push(
        'FUSION_REDUCED_SAMPLE_INSUFFICIENT',
      );
    }


    if (
      sampleSize >=
        resolved.minimumSampleSize &&
      observedHitRate <
        resolved.minimumOverallHitRate
    ) {
      blockers.push(
        'FUSION_REDUCED_OVERALL_RATE_BELOW_GATE',
      );
    }


    if (
      recentSampleSize <
      resolved.recentWindowSize
    ) {
      blockers.push(
        'FUSION_REDUCED_RECENT_WINDOW_INCOMPLETE',
      );
    } else if (
      recentHitRate <
      resolved.minimumRecentHitRate
    ) {
      blockers.push(
        'FUSION_REDUCED_RECENT_RATE_BELOW_GATE',
      );
    }


    if (
      recentSampleSize ===
        resolved.recentWindowSize &&
      rateDrift >
        resolved.maximumRateDrift
    ) {
      blockers.push(
        'FUSION_REDUCED_RATE_DRIFT_EXCESSIVE',
      );
    }


    const expectedCoverageRate =
      this.doctrine.totalCoverage /
      37;


    if (
      observedHitRate <=
      expectedCoverageRate
    ) {
      warnings.push(
        'FUSION_REDUCED_NO_GLOBAL_LIFT_OVER_NOMINAL_COVERAGE',
      );
    }


    if (
      recentHitRate <=
      expectedCoverageRate
    ) {
      warnings.push(
        'FUSION_REDUCED_NO_RECENT_LIFT_OVER_NOMINAL_COVERAGE',
      );
    }


    const overallGateScore =
      this.normalizedGateScore(
        observedHitRate,
        resolved.minimumOverallHitRate,
      );

    const recentGateScore =
      this.normalizedGateScore(
        recentHitRate,
        resolved.minimumRecentHitRate,
      );

    const stabilityScore =
      this.stabilityScore(
        rateDrift,
        resolved.maximumRateDrift,
      );


    const confidenceScore =
      this.round4(
        (
          sampleAdequacy *
          0.30
        ) +
        (
          overallGateScore *
          0.25
        ) +
        (
          recentGateScore *
          0.30
        ) +
        (
          stabilityScore *
          0.15
        ),
      );


    const riskScore =
      this.round4(
        1 -
        confidenceScore,
      );


    const eligible =
      blockers.length ===
      0;


    if (
      eligible
    ) {
      reasons.push(
        'FUSION_REDUCED_EMPIRICAL_GATE_PASSED',
      );
    } else {
      reasons.push(
        'FUSION_REDUCED_EMPIRICAL_GATE_NOT_PASSED',
      );
    }


    reasons.push(
      'FUSION_REDUCED_FIXED_TARGET_23_PLUS_MINUS_9',
      'FUSION_REDUCED_PAPER_VALIDATION_REQUIRED',
    );


    return Object.freeze({
      strategyId:
        'fusion-reduced' as const,

      eligible,

      confidenceScore,

      riskScore,

      blockers:
        Object.freeze([
          ...blockers,
        ]),

      warnings:
        Object.freeze([
          ...warnings,
        ]),

      reasons:
        Object.freeze([
          ...reasons,
        ]),

      sampleSize,

      recentSampleSize,

      targetSize:
        19 as const,

      expectedCoverageRate:
        this.round4(
          expectedCoverageRate,
        ),

      observedHitCount,

      observedMissCount,

      observedHitRate:
        this.round4(
          observedHitRate,
        ),

      recentHitCount,

      recentMissCount,

      recentHitRate:
        this.round4(
          recentHitRate,
        ),

      rateDrift:
        this.round4(
          rateDrift,
        ),

      sampleAdequacy:
        this.round4(
          sampleAdequacy,
        ),

      targetNumbers:
        Object.freeze([
          ...this.doctrine
            .targetNumbers,
        ]),

      paperOnly:
        true as const,

      recommendationOnly:
        true as const,

      automaticExecutionAllowed:
        false as const,
    });
  }


  private resolveOptions(
    options:
      FusionReducedEvidenceOptions,
  ): ResolvedFusionReducedEvidenceOptions {
    const resolved = {
      minimumSampleSize:
        options.minimumSampleSize ??
        DEFAULT_OPTIONS.minimumSampleSize,

      recentWindowSize:
        options.recentWindowSize ??
        DEFAULT_OPTIONS.recentWindowSize,

      minimumOverallHitRate:
        options.minimumOverallHitRate ??
        DEFAULT_OPTIONS.minimumOverallHitRate,

      minimumRecentHitRate:
        options.minimumRecentHitRate ??
        DEFAULT_OPTIONS.minimumRecentHitRate,

      maximumRateDrift:
        options.maximumRateDrift ??
        DEFAULT_OPTIONS.maximumRateDrift,
    };


    if (
      !Number.isInteger(
        resolved.minimumSampleSize,
      ) ||
      resolved.minimumSampleSize <=
        0
    ) {
      throw new Error(
        'fusion_reduced_invalid_minimum_sample_size',
      );
    }


    if (
      !Number.isInteger(
        resolved.recentWindowSize,
      ) ||
      resolved.recentWindowSize <=
        0
    ) {
      throw new Error(
        'fusion_reduced_invalid_recent_window_size',
      );
    }


    this.validateRate(
      resolved.minimumOverallHitRate,
      'fusion_reduced_invalid_minimum_overall_hit_rate',
    );

    this.validateRate(
      resolved.minimumRecentHitRate,
      'fusion_reduced_invalid_minimum_recent_hit_rate',
    );

    this.validateRate(
      resolved.maximumRateDrift,
      'fusion_reduced_invalid_maximum_rate_drift',
    );


    return Object.freeze(
      resolved,
    );
  }


  private validateHistory(
    history:
      readonly number[],
  ): void {
    if (
      !Array.isArray(
        history,
      )
    ) {
      throw new Error(
        'fusion_reduced_invalid_history',
      );
    }


    for (
      const spin of
      history
    ) {
      if (
        !Number.isInteger(
          spin,
        ) ||
        spin < 0 ||
        spin > 36
      ) {
        throw new Error(
          'fusion_reduced_invalid_spin',
        );
      }
    }
  }


  private validateRate(
    value:
      number,

    errorCode:
      string,
  ): void {
    if (
      !Number.isFinite(
        value,
      ) ||
      value < 0 ||
      value > 1
    ) {
      throw new Error(
        errorCode,
      );
    }
  }


  private hitCount(
    history:
      readonly number[],

    target:
      ReadonlySet<number>,
  ): number {
    let hits =
      0;

    for (
      const spin of
      history
    ) {
      if (
        target.has(
          spin,
        )
      ) {
        hits +=
          1;
      }
    }

    return hits;
  }


  private rate(
    hits:
      number,

    sampleSize:
      number,
  ): number {
    if (
      sampleSize ===
      0
    ) {
      return 0;
    }

    return hits /
      sampleSize;
  }


  private normalizedGateScore(
    observed:
      number,

    gate:
      number,
  ): number {
    if (
      gate <=
      0
    ) {
      return 1;
    }

    return Math.min(
      1,
      observed /
      gate,
    );
  }


  private stabilityScore(
    drift:
      number,

    maximum:
      number,
  ): number {
    if (
      maximum <=
      0
    ) {
      return drift ===
        0
        ? 1
        : 0;
    }

    return Math.max(
      0,
      1 -
      (
        drift /
        maximum
      ),
    );
  }


  private round4(
    value:
      number,
  ): number {
    return Math.round(
      value *
      10000,
    ) /
    10000;
  }
}
