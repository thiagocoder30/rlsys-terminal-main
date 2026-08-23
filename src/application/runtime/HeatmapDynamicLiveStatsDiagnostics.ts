import type {
  HeatmapDynamicLiveTerminalSpinResult,
} from './HeatmapDynamicLiveTerminalController.js';


export interface HeatmapDynamicLiveDiagnosticEvent {
  readonly liveSpinIndex:
    number;

  readonly spin:
    number;

  readonly decisionStatus:
    string;

  readonly analyticalMode:
    string;

  readonly signalStrength:
    string;

  readonly fusionPressureScore:
    number;

  readonly recencyPressureScore:
    number;

  readonly dispersionScore:
    number;

  readonly confidenceScore:
    number;

  readonly riskScore:
    number;

  readonly targetRegionId:
    string | null;

  readonly targetNumbers:
    readonly number[];

  readonly targetSize:
    number;

  readonly coveragePercent:
    number;

  readonly registeredDecisionIndex:
    number | null;

  readonly settledDecisionIndex:
    number | null;

  readonly settlementOutcome:
    'WIN' | 'LOSS' | null;

  readonly settledBySpin:
    number | null;

  readonly blockers:
    readonly string[];

  readonly warnings:
    readonly string[];
}


export interface HeatmapDynamicRegionFrequency {
  readonly regionId:
    string;

  readonly count:
    number;

  readonly percent:
    number;
}


export interface HeatmapDynamicBlockerFrequency {
  readonly blocker:
    string;

  readonly count:
    number;
}


export interface HeatmapDynamicLiveStatsSnapshot {
  readonly strategyId:
    'heatmap-dynamic';

  readonly liveSpinCount:
    number;

  readonly blockedCount:
    number;

  readonly observeCount:
    number;

  readonly paperReadyCount:
    number;

  readonly blockedPercent:
    number;

  readonly observePercent:
    number;

  readonly paperReadyPercent:
    number;

  readonly averageFusionPressureScore:
    number;

  readonly averageRecencyPressureScore:
    number;

  readonly averageDispersionScore:
    number;

  readonly averageConfidenceScore:
    number;

  readonly averageRiskScore:
    number;

  readonly averageTargetSize:
    number;

  readonly averageCoveragePercent:
    number;

  readonly predominantTargetRegion:
    string | null;

  readonly targetRegionFrequency:
    readonly HeatmapDynamicRegionFrequency[];

  readonly blockerFrequency:
    readonly HeatmapDynamicBlockerFrequency[];

  readonly counterfactualDecisionCount:
    number;

  readonly counterfactualSettledCount:
    number;

  readonly counterfactualPendingCount:
    number;

  readonly counterfactualWinCount:
    number;

  readonly counterfactualLossCount:
    number;

  readonly counterfactualHitRate:
    number | null;

  readonly counterfactualMaxLossStreak:
    number;

  readonly latestEvents:
    readonly HeatmapDynamicLiveDiagnosticEvent[];

  readonly paperOnly:
    true;

  readonly recommendationOnly:
    true;

  readonly bankrollChanged:
    false;

  readonly automaticExecution:
    false;
}


/**
 * Read-only diagnostics for HEATMAP DYNAMIC.
 *
 * It observes results after the controller has already enforced
 * the temporal t -> t+1 settlement boundary.
 *
 * It never:
 * - creates hypotheses;
 * - changes thresholds;
 * - settles hypotheses itself;
 * - changes bankroll;
 * - executes bets.
 */
export class HeatmapDynamicLiveStatsDiagnostics {
  private readonly events:
    HeatmapDynamicLiveDiagnosticEvent[] =
      [];


  public record(
    result:
      HeatmapDynamicLiveTerminalSpinResult,
  ): HeatmapDynamicLiveDiagnosticEvent {
    const hypothesis =
      result
        .decision
        .hypothesis;

    const topRegion =
      result
        .analysis
        .targetRegions[0] ??
      null;

    const targetRegionId =
      hypothesis
        ?.targetRegionId ??
      topRegion
        ?.regionId ??
      null;

    const targetNumbers =
      Object.freeze([
        ...(
          hypothesis
            ?.targetNumbers ??
          topRegion
            ?.numbers ??
          []
        ),
      ]);

    const registered =
      result
        .registeredCounterfactualDecision;

    const settlement =
      result
        .previousSettlement;

    const targetSize =
      registered
        ?.targetSize ??
      targetNumbers.length;

    const coveragePercent =
      registered
        ?.coveragePercent ??
      this.coverage(
        targetSize,
      );

    const event:
      HeatmapDynamicLiveDiagnosticEvent =
      Object.freeze({
        liveSpinIndex:
          result.liveSpinIndex,

        spin:
          result.spin,

        decisionStatus:
          result.decision.status,

        analyticalMode:
          result.analysis.mode,

        signalStrength:
          result.analysis.signalStrength,

        fusionPressureScore:
          result.analysis.fusionPressureScore,

        recencyPressureScore:
          result.analysis.recencyPressureScore,

        dispersionScore:
          result.analysis.dispersionScore,

        confidenceScore:
          result.analysis.fusionConfidenceScore,

        riskScore:
          result.analysis.fusionRiskScore,

        targetRegionId,

        targetNumbers,

        targetSize,

        coveragePercent,

        registeredDecisionIndex:
          registered
            ?.decisionIndex ??
          null,

        settledDecisionIndex:
          settlement
            ?.decisionIndex ??
          null,

        settlementOutcome:
          settlement
            ?.outcome ??
          null,

        settledBySpin:
          settlement
            ?.settledBySpin ??
          null,

        blockers:
          Object.freeze([
            ...result
              .decision
              .blockers,
          ]),

        warnings:
          Object.freeze([
            ...result
              .decision
              .warnings,
          ]),
      });

    this.events.push(
      event,
    );

    return event;
  }


  public snapshot(
    latestLimit:
      number = 12,
  ): HeatmapDynamicLiveStatsSnapshot {
    const normalizedLimit =
      Number.isInteger(
        latestLimit,
      ) &&
      latestLimit >
        0
        ? latestLimit
        : 12;

    const liveSpinCount =
      this.events.length;

    const blockedCount =
      this.countStatus(
        'BLOCKED',
      );

    const observeCount =
      this.countStatus(
        'OBSERVE',
      );

    const paperReadyCount =
      this.countStatus(
        'PAPER_READY',
      );

    const counterfactualDecisionCount =
      this.events.filter(
        (event) =>
          event.registeredDecisionIndex !==
          null,
      ).length;

    const settledEvents =
      this.events.filter(
        (event) =>
          event.settledDecisionIndex !==
          null,
      );

    const counterfactualSettledCount =
      settledEvents.length;

    const counterfactualWinCount =
      settledEvents.filter(
        (event) =>
          event.settlementOutcome ===
          'WIN',
      ).length;

    const counterfactualLossCount =
      settledEvents.filter(
        (event) =>
          event.settlementOutcome ===
          'LOSS',
      ).length;

    const targetEvents =
      this.events.filter(
        (event) =>
          event.targetSize >
          0,
      );

    const targetRegionFrequency =
      this.regionFrequency();

    return Object.freeze({
      strategyId:
        'heatmap-dynamic' as const,

      liveSpinCount,

      blockedCount,

      observeCount,

      paperReadyCount,

      blockedPercent:
        this.percent(
          blockedCount,
          liveSpinCount,
        ),

      observePercent:
        this.percent(
          observeCount,
          liveSpinCount,
        ),

      paperReadyPercent:
        this.percent(
          paperReadyCount,
          liveSpinCount,
        ),

      averageFusionPressureScore:
        this.average(
          this.events.map(
            (event) =>
              event.fusionPressureScore,
          ),
        ),

      averageRecencyPressureScore:
        this.average(
          this.events.map(
            (event) =>
              event.recencyPressureScore,
          ),
        ),

      averageDispersionScore:
        this.average(
          this.events.map(
            (event) =>
              event.dispersionScore,
          ),
        ),

      averageConfidenceScore:
        this.average(
          this.events.map(
            (event) =>
              event.confidenceScore,
          ),
        ),

      averageRiskScore:
        this.average(
          this.events.map(
            (event) =>
              event.riskScore,
          ),
        ),

      averageTargetSize:
        this.average(
          targetEvents.map(
            (event) =>
              event.targetSize,
          ),
        ),

      averageCoveragePercent:
        this.average(
          targetEvents.map(
            (event) =>
              event.coveragePercent,
          ),
        ),

      predominantTargetRegion:
        targetRegionFrequency[0]
          ?.regionId ??
        null,

      targetRegionFrequency,

      blockerFrequency:
        this.blockerFrequency(),

      counterfactualDecisionCount,

      counterfactualSettledCount,

      counterfactualPendingCount:
        Math.max(
          0,
          counterfactualDecisionCount -
          counterfactualSettledCount,
        ),

      counterfactualWinCount,

      counterfactualLossCount,

      counterfactualHitRate:
        counterfactualSettledCount >
          0
          ? this.percent(
              counterfactualWinCount,
              counterfactualSettledCount,
            )
          : null,

      counterfactualMaxLossStreak:
        this.maxLossStreak(
          settledEvents,
        ),

      latestEvents:
        Object.freeze(
          this.events.slice(
            Math.max(
              0,
              this.events.length -
              normalizedLimit,
            ),
          ),
        ),

      paperOnly:
        true as const,

      recommendationOnly:
        true as const,

      bankrollChanged:
        false as const,

      automaticExecution:
        false as const,
    });
  }


  public eventsSnapshot():
    readonly HeatmapDynamicLiveDiagnosticEvent[] {
    return Object.freeze([
      ...this.events,
    ]);
  }


  private countStatus(
    status:
      string,
  ): number {
    return this.events.filter(
      (event) =>
        event.decisionStatus ===
        status,
    ).length;
  }


  private regionFrequency():
    readonly HeatmapDynamicRegionFrequency[] {
    const counts =
      new Map<
        string,
        number
      >();

    for (
      const event of
      this.events
    ) {
      if (
        event.targetRegionId ===
        null
      ) {
        continue;
      }

      counts.set(
        event.targetRegionId,
        (
          counts.get(
            event.targetRegionId,
          ) ??
          0
        ) +
          1,
      );
    }

    const total =
      [...counts.values()]
        .reduce(
          (
            sum,
            count,
          ) =>
            sum +
            count,
          0,
        );

    return Object.freeze(
      [...counts.entries()]
        .map(
          (
            [
              regionId,
              count,
            ],
          ) =>
            Object.freeze({
              regionId,

              count,

              percent:
                this.percent(
                  count,
                  total,
                ),
            }),
        )
        .sort(
          (
            left,
            right,
          ) =>
            right.count -
              left.count ||
            left
              .regionId
              .localeCompare(
                right.regionId,
              ),
        ),
    );
  }


  private blockerFrequency():
    readonly HeatmapDynamicBlockerFrequency[] {
    const counts =
      new Map<
        string,
        number
      >();

    for (
      const event of
      this.events
    ) {
      for (
        const blocker of
        event.blockers
      ) {
        counts.set(
          blocker,
          (
            counts.get(
              blocker,
            ) ??
            0
          ) +
            1,
        );
      }
    }

    return Object.freeze(
      [...counts.entries()]
        .map(
          (
            [
              blocker,
              count,
            ],
          ) =>
            Object.freeze({
              blocker,
              count,
            }),
        )
        .sort(
          (
            left,
            right,
          ) =>
            right.count -
              left.count ||
            left
              .blocker
              .localeCompare(
                right.blocker,
              ),
        ),
    );
  }


  private maxLossStreak(
    settledEvents:
      readonly HeatmapDynamicLiveDiagnosticEvent[],
  ): number {
    let current =
      0;

    let maximum =
      0;

    for (
      const event of
      settledEvents
    ) {
      if (
        event.settlementOutcome ===
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

      if (
        event.settlementOutcome ===
        'WIN'
      ) {
        current =
          0;
      }
    }

    return maximum;
  }


  private coverage(
    targetSize:
      number,
  ): number {
    if (
      targetSize <=
      0
    ) {
      return 0;
    }

    return Math.round(
      (
        targetSize /
        37
      ) *
      1000,
    ) /
    10;
  }


  private average(
    values:
      readonly number[],
  ): number {
    if (
      values.length ===
      0
    ) {
      return 0;
    }

    return Math.round(
      (
        values.reduce(
          (
            sum,
            value,
          ) =>
            sum +
            value,
          0,
        ) /
        values.length
      ) *
      1000,
    ) /
    1000;
  }


  private percent(
    part:
      number,

    total:
      number,
  ): number {
    if (
      total <=
      0
    ) {
      return 0;
    }

    return Math.round(
      (
        part /
        total
      ) *
      1000,
    ) /
    10;
  }
}
