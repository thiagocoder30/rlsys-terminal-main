import type {
  HeatmapDynamicProspectiveDecision,
  HeatmapDynamicProspectiveHypothesis,
} from './HeatmapDynamicProspectiveDecisionSemantics.js';


export type HeatmapDynamicCounterfactualOutcome =
  | 'WIN'
  | 'LOSS';


export interface HeatmapDynamicCounterfactualDecisionPoint {
  readonly strategyId:
    'heatmap-dynamic';

  readonly decisionIndex:
    number;

  readonly decision:
    HeatmapDynamicProspectiveDecision;

  readonly hypothesis:
    HeatmapDynamicProspectiveHypothesis;

  readonly targetNumbers:
    readonly number[];

  readonly targetSize:
    number;

  readonly coveragePercent:
    number;
}


export interface HeatmapDynamicCounterfactualSettlement {
  readonly strategyId:
    'heatmap-dynamic';

  readonly decisionIndex:
    number;

  readonly decision:
    HeatmapDynamicProspectiveDecision;

  readonly hypothesis:
    HeatmapDynamicProspectiveHypothesis;

  readonly targetNumbers:
    readonly number[];

  readonly targetSize:
    number;

  readonly coveragePercent:
    number;

  readonly outcome:
    HeatmapDynamicCounterfactualOutcome;

  readonly settledBySpin:
    number;

  readonly paperOnly:
    true;

  readonly bankrollChanged:
    false;

  readonly automaticExecution:
    false;
}


export interface HeatmapDynamicCounterfactualSnapshot {
  readonly strategyId:
    'heatmap-dynamic';

  readonly pending:
    HeatmapDynamicCounterfactualDecisionPoint | null;

  readonly settledCount:
    number;

  readonly winCount:
    number;

  readonly lossCount:
    number;

  readonly hitRate:
    number | null;

  readonly averageTargetSize:
    number;

  readonly averageCoveragePercent:
    number;

  readonly maxLossStreak:
    number;

  readonly paperOnly:
    true;

  readonly bankrollChanged:
    false;

  readonly automaticExecution:
    false;
}


function normalizeTargets(
  values:
    readonly number[],
): readonly number[] {
  return Object.freeze(
    Array.from(
      new Set(
        values,
      ),
    )
      .filter(
        (value) =>
          Number.isInteger(
            value,
          ) &&
          value >= 0 &&
          value <= 36,
      )
      .sort(
        (
          left,
          right,
        ) =>
          left -
          right,
      ),
  );
}


function coveragePercent(
  targetSize:
    number,
): number {
  return Math.round(
    (
      targetSize /
      37
    ) *
    1000,
  ) /
  10;
}


function cloneHypothesis(
  hypothesis:
    HeatmapDynamicProspectiveHypothesis,

  targetNumbers:
    readonly number[],
): HeatmapDynamicProspectiveHypothesis {
  return Object.freeze({
    ...hypothesis,

    targetNumbers:
      Object.freeze([
        ...targetNumbers,
      ]),
  });
}


function cloneDecision(
  decision:
    HeatmapDynamicProspectiveDecision,

  hypothesis:
    HeatmapDynamicProspectiveHypothesis,
): HeatmapDynamicProspectiveDecision {
  return Object.freeze({
    ...decision,

    hypothesis,

    blockers:
      Object.freeze([
        ...decision.blockers,
      ]),

    warnings:
      Object.freeze([
        ...decision.warnings,
      ]),

    reasons:
      Object.freeze([
        ...decision.reasons,
      ]),
  });
}


/**
 * Prospective counterfactual settlement for HEATMAP DYNAMIC.
 *
 * Temporal contract:
 *
 * LIVE t
 *   ↓
 * Heatmap Dynamic produces PAPER_READY(t)
 *   ↓
 * target is frozen
 *   ↓
 * waits
 *   ↓
 * LIVE t+1
 *   ↓
 * t+1 settles decision(t)
 *   ↓
 * WIN / LOSS
 *
 * Dynamic targets may have different sizes. Therefore this engine also
 * records target size and wheel coverage. Hit rate alone must not be
 * interpreted as sufficient evidence of strategy quality.
 *
 * This engine has no:
 * - stake calculation;
 * - bankroll mutation;
 * - martingale;
 * - live-money authority;
 * - automatic execution.
 */
export class HeatmapDynamicCounterfactualSettlementEngine {
  private nextDecisionIndex =
    1;

  private pending:
    HeatmapDynamicCounterfactualDecisionPoint | null =
      null;

  private readonly settlements:
    HeatmapDynamicCounterfactualSettlement[] =
      [];


  public registerDecision(
    decision:
      HeatmapDynamicProspectiveDecision,
  ): HeatmapDynamicCounterfactualDecisionPoint | null {
    if (
      decision.status !==
      'PAPER_READY'
    ) {
      return null;
    }

    if (
      decision.hypothesis ===
      null
    ) {
      return null;
    }

    if (
      decision.hypothesis.strategyId !==
      'heatmap-dynamic'
    ) {
      return null;
    }

    if (
      this.pending !==
      null
    ) {
      return null;
    }

    const targetNumbers =
      normalizeTargets(
        decision
          .hypothesis
          .targetNumbers,
      );

    if (
      targetNumbers.length ===
      0
    ) {
      return null;
    }

    const hypothesis =
      cloneHypothesis(
        decision.hypothesis,
        targetNumbers,
      );

    const frozenDecision =
      cloneDecision(
        decision,
        hypothesis,
      );

    const point:
      HeatmapDynamicCounterfactualDecisionPoint =
      Object.freeze({
        strategyId:
          'heatmap-dynamic' as const,

        decisionIndex:
          this.nextDecisionIndex,

        decision:
          frozenDecision,

        hypothesis,

        targetNumbers,

        targetSize:
          targetNumbers.length,

        coveragePercent:
          coveragePercent(
            targetNumbers.length,
          ),
      });

    this.nextDecisionIndex +=
      1;

    this.pending =
      point;

    return this.cloneDecisionPoint(
      point,
    );
  }


  public settleNextSpin(
    spin:
      number,
  ): HeatmapDynamicCounterfactualSettlement | null {
    this.validateSpin(
      spin,
    );

    if (
      this.pending ===
      null
    ) {
      return null;
    }

    const point =
      this.pending;

    this.pending =
      null;

    const outcome:
      HeatmapDynamicCounterfactualOutcome =
      point
        .targetNumbers
        .includes(
          spin,
        )
        ? 'WIN'
        : 'LOSS';

    const settlement:
      HeatmapDynamicCounterfactualSettlement =
      Object.freeze({
        strategyId:
          'heatmap-dynamic' as const,

        decisionIndex:
          point.decisionIndex,

        decision:
          point.decision,

        hypothesis:
          point.hypothesis,

        targetNumbers:
          point.targetNumbers,

        targetSize:
          point.targetSize,

        coveragePercent:
          point.coveragePercent,

        outcome,

        settledBySpin:
          spin,

        paperOnly:
          true as const,

        bankrollChanged:
          false as const,

        automaticExecution:
          false as const,
      });

    this.settlements.push(
      settlement,
    );

    return this.cloneSettlement(
      settlement,
    );
  }


  public pendingDecision():
    HeatmapDynamicCounterfactualDecisionPoint | null {
    if (
      this.pending ===
      null
    ) {
      return null;
    }

    return this.cloneDecisionPoint(
      this.pending,
    );
  }


  public history():
    readonly HeatmapDynamicCounterfactualSettlement[] {
    return Object.freeze(
      this.settlements.map(
        (settlement) =>
          this.cloneSettlement(
            settlement,
          ),
      ),
    );
  }


  public snapshot():
    HeatmapDynamicCounterfactualSnapshot {
    const winCount =
      this.settlements.filter(
        (settlement) =>
          settlement.outcome ===
          'WIN',
      ).length;

    const lossCount =
      this.settlements.filter(
        (settlement) =>
          settlement.outcome ===
          'LOSS',
      ).length;

    const settledCount =
      this.settlements.length;

    const hitRate =
      settledCount >
        0
        ? Math.round(
            (
              winCount /
              settledCount
            ) *
            1000,
          ) /
          10
        : null;

    const averageTargetSize =
      settledCount >
        0
        ? Math.round(
            (
              this.settlements.reduce(
                (
                  sum,
                  settlement,
                ) =>
                  sum +
                  settlement.targetSize,
                0,
              ) /
              settledCount
            ) *
            1000,
          ) /
          1000
        : 0;

    const averageCoveragePercent =
      settledCount >
        0
        ? Math.round(
            (
              this.settlements.reduce(
                (
                  sum,
                  settlement,
                ) =>
                  sum +
                  settlement.coveragePercent,
                0,
              ) /
              settledCount
            ) *
            1000,
          ) /
          1000
        : 0;

    return Object.freeze({
      strategyId:
        'heatmap-dynamic' as const,

      pending:
        this.pendingDecision(),

      settledCount,

      winCount,

      lossCount,

      hitRate,

      averageTargetSize,

      averageCoveragePercent,

      maxLossStreak:
        this.maxLossStreak(),

      paperOnly:
        true as const,

      bankrollChanged:
        false as const,

      automaticExecution:
        false as const,
    });
  }


  private maxLossStreak():
    number {
    let current =
      0;

    let maximum =
      0;

    for (
      const settlement of
      this.settlements
    ) {
      if (
        settlement.outcome ===
        'LOSS'
      ) {
        current +=
          1;

        maximum =
          Math.max(
            maximum,
            current,
          );

        continue;
      }

      current =
        0;
    }

    return maximum;
  }


  private cloneDecisionPoint(
    point:
      HeatmapDynamicCounterfactualDecisionPoint,
  ): HeatmapDynamicCounterfactualDecisionPoint {
    const targetNumbers =
      Object.freeze([
        ...point.targetNumbers,
      ]);

    const hypothesis =
      cloneHypothesis(
        point.hypothesis,
        targetNumbers,
      );

    return Object.freeze({
      strategyId:
        'heatmap-dynamic' as const,

      decisionIndex:
        point.decisionIndex,

      decision:
        cloneDecision(
          point.decision,
          hypothesis,
        ),

      hypothesis,

      targetNumbers,

      targetSize:
        point.targetSize,

      coveragePercent:
        point.coveragePercent,
    });
  }


  private cloneSettlement(
    settlement:
      HeatmapDynamicCounterfactualSettlement,
  ): HeatmapDynamicCounterfactualSettlement {
    const targetNumbers =
      Object.freeze([
        ...settlement.targetNumbers,
      ]);

    const hypothesis =
      cloneHypothesis(
        settlement.hypothesis,
        targetNumbers,
      );

    return Object.freeze({
      strategyId:
        'heatmap-dynamic' as const,

      decisionIndex:
        settlement.decisionIndex,

      decision:
        cloneDecision(
          settlement.decision,
          hypothesis,
        ),

      hypothesis,

      targetNumbers,

      targetSize:
        settlement.targetSize,

      coveragePercent:
        settlement.coveragePercent,

      outcome:
        settlement.outcome,

      settledBySpin:
        settlement.settledBySpin,

      paperOnly:
        true as const,

      bankrollChanged:
        false as const,

      automaticExecution:
        false as const,
    });
  }


  private validateSpin(
    spin:
      number,
  ): void {
    if (
      !Number.isInteger(
        spin,
      ) ||
      spin < 0 ||
      spin > 36
    ) {
      throw new Error(
        `heatmap_dynamic_counterfactual_invalid_spin:${spin}`,
      );
    }
  }
}
