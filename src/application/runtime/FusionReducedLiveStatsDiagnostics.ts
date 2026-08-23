import type {
  FusionReducedLiveTerminalSpinResult,
} from './FusionReducedLiveTerminalController.js';


export interface FusionReducedLiveDiagnosticEvent {
  readonly liveSpinIndex:
    number;

  readonly spin:
    number;

  readonly decisionStatus:
    string;

  readonly eligible:
    boolean;

  readonly confidenceScore:
    number;

  readonly riskScore:
    number;

  readonly observedHitRate:
    number;

  readonly recentHitRate:
    number;

  readonly rateDrift:
    number;

  readonly sampleSize:
    number;

  readonly recentSampleSize:
    number;

  readonly targetSize:
    19;

  readonly coveragePercent:
    number;

  readonly hypothesisCreated:
    boolean;

  readonly settlementOutcome:
    'WIN' | 'LOSS' | null;

  readonly settlementSpin:
    number | null;

  readonly blockers:
    readonly string[];

  readonly warnings:
    readonly string[];
}


export interface FusionReducedBlockerFrequency {
  readonly blocker:
    string;

  readonly count:
    number;
}


export interface FusionReducedLiveStatsSnapshot {
  readonly strategyId:
    'fusion-reduced';

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

  readonly averageConfidenceScore:
    number;

  readonly averageRiskScore:
    number;

  readonly averageObservedHitRate:
    number;

  readonly averageRecentHitRate:
    number;

  readonly averageRateDrift:
    number;

  readonly targetCenter:
    23;

  readonly targetSize:
    19;

  readonly coveragePercent:
    number;

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

  readonly blockerFrequency:
    readonly FusionReducedBlockerFrequency[];

  readonly latestEvents:
    readonly FusionReducedLiveDiagnosticEvent[];

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
 * Historical diagnostics for FUSION REDUZIDA.
 *
 * This class observes already-produced LIVE results.
 *
 * It never changes:
 * - doctrine;
 * - evidence thresholds;
 * - decisions;
 * - settlements;
 * - bankroll.
 */
export class FusionReducedLiveStatsDiagnostics {
  private readonly events:
    FusionReducedLiveDiagnosticEvent[] =
      [];


  public record(
    result:
      FusionReducedLiveTerminalSpinResult,
  ): FusionReducedLiveDiagnosticEvent {
    const event:
      FusionReducedLiveDiagnosticEvent =
      Object.freeze({
        liveSpinIndex:
          result.liveSpinIndex,

        spin:
          result.spin,

        decisionStatus:
          result.decision.status,

        eligible:
          result.evidence.eligible,

        confidenceScore:
          result.evidence.confidenceScore,

        riskScore:
          result.evidence.riskScore,

        observedHitRate:
          result.evidence.observedHitRate,

        recentHitRate:
          result.evidence.recentHitRate,

        rateDrift:
          result.evidence.rateDrift,

        sampleSize:
          result.evidence.sampleSize,

        recentSampleSize:
          result.evidence.recentSampleSize,

        targetSize:
          19 as const,

        coveragePercent:
          this.coveragePercent(),

        hypothesisCreated:
          result.registeredCounterfactualDecision !==
          null,

        settlementOutcome:
          result.previousSettlement
            ?.outcome ??
          null,

        settlementSpin:
          result.previousSettlement
            ?.spin ??
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
  ): FusionReducedLiveStatsSnapshot {
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
          event.hypothesisCreated,
      ).length;

    const settledEvents =
      this.events.filter(
        (event) =>
          event.settlementOutcome !==
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

    return Object.freeze({
      strategyId:
        'fusion-reduced' as const,

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

      averageObservedHitRate:
        this.average(
          this.events.map(
            (event) =>
              event.observedHitRate,
          ),
        ),

      averageRecentHitRate:
        this.average(
          this.events.map(
            (event) =>
              event.recentHitRate,
          ),
        ),

      averageRateDrift:
        this.average(
          this.events.map(
            (event) =>
              event.rateDrift,
          ),
        ),

      targetCenter:
        23 as const,

      targetSize:
        19 as const,

      coveragePercent:
        this.coveragePercent(),

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

      blockerFrequency:
        this.blockerFrequency(),

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
    readonly FusionReducedLiveDiagnosticEvent[] {
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


  private blockerFrequency():
    readonly FusionReducedBlockerFrequency[] {
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
      readonly FusionReducedLiveDiagnosticEvent[],
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
      10000,
    ) /
    10000;
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


  private coveragePercent():
    number {
    return Math.round(
      (
        19 /
        37
      ) *
      10000,
    ) /
    100;
  }
}
