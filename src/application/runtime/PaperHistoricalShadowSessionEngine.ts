import {
  HistoricalShadowReplayEngine,
  type HistoricalShadowProvider,
  type HistoricalShadowReplaySnapshot,
} from './HistoricalShadowReplayEngine.js';

import {
  FusionReducedShadowAdapter,
} from './FusionReducedShadowAdapter.js';

import {
  HeatmapDynamicShadowAdapter,
} from './HeatmapDynamicShadowAdapter.js';

import {
  TriplicacaoShadowAdapter,
} from './TriplicacaoShadowAdapter.js';

import type {
  PaperCapitalRiskMode,
} from './PaperCapitalPreservationGuard.js';


export interface PaperHistoricalShadowSessionInput {
  readonly history:
    readonly number[];

  readonly initialBankroll:
    number;

  readonly riskMode:
    PaperCapitalRiskMode;

  readonly provider:
    HistoricalShadowProvider;

  readonly minimumChipValue:
    number;

  readonly martingaleEnabled:
    boolean;
}


export interface PaperHistoricalShadowStrategySummary {
  readonly strategyId:
    string;

  readonly totalSpins:
    number;

  readonly tradeCount:
    number;

  readonly winCount:
    number;

  readonly lossCount:
    number;

  readonly voidCount:
    number;

  readonly hitRate:
    number | null;

  readonly totalStake:
    number;

  readonly totalPnl:
    number;

  readonly roiPercent:
    number | null;

  readonly initialBankroll:
    number;

  readonly currentBankroll:
    number;

  readonly bankrollReturnPercent:
    number;

  readonly maxLossStreak:
    number;

  readonly maxDrawdownAmount:
    number;

  readonly maxDrawdownPercent:
    number;

  readonly capitalStop:
    boolean;

  readonly capitalStopReason:
    string | null;

  readonly noSignalDecisionPointCount:
    number;

  readonly financiallyBlockedDecisionCount:
    number;

  readonly capitalBlockedDecisionPointCount:
    number;
}


export interface PaperHistoricalShadowSessionSnapshot {
  readonly totalSpins:
    number;

  readonly initialBankroll:
    number;

  readonly provider:
    HistoricalShadowProvider;

  readonly riskMode:
    PaperCapitalRiskMode;

  readonly minimumChipValue:
    number;

  readonly martingaleEnabled:
    boolean;

  readonly triplicacao:
    HistoricalShadowReplaySnapshot;

  readonly fusionReduced:
    HistoricalShadowReplaySnapshot;

  readonly heatmapDynamic:
    HistoricalShadowReplaySnapshot;

  readonly summaries:
    readonly PaperHistoricalShadowStrategySummary[];

  readonly historicalShadow:
    true;

  readonly retrospectiveOnly:
    true;

  readonly lookAheadAllowed:
    false;

  readonly realBankrollChanged:
    false;

  readonly automaticExecution:
    false;

  readonly humanExecutionRequired:
    true;
}


/**
 * Aggregates the three canonical historical SHADOW strategies
 * for one synchronized PAPER session.
 *
 * Sovereign invariants:
 *
 * - all strategies consume the exact same synchronized history;
 * - all strategies start from the exact same initial bankroll;
 * - bankroll paths remain independent between strategies;
 * - no strategy receives another strategy's simulated P&L;
 * - the supplied history is retrospective only;
 * - this engine creates no LIVE decision;
 * - this engine changes no real bankroll;
 * - this engine exposes no betting/execution API.
 */
export class PaperHistoricalShadowSessionEngine {
  public run(
    input:
      PaperHistoricalShadowSessionInput,
  ): PaperHistoricalShadowSessionSnapshot {
    this.validate(
      input,
    );

    const history =
      Object.freeze([
        ...input.history,
      ]);

    const replayConfiguration =
      Object.freeze({
        initialBankroll:
          input.initialBankroll,

        riskMode:
          input.riskMode,

        provider:
          input.provider,

        minimumChipValue:
          input.minimumChipValue,
      });

    /*
     * Fresh replay/adapters are deliberately created for each run.
     *
     * Triplicacao owns a recovery ledger, therefore adapter reuse
     * across session reports would leak historical financial state.
     */
    const triplicacao =
      new HistoricalShadowReplayEngine()
        .replay(
          history,
          new TriplicacaoShadowAdapter({
            martingaleEnabled:
              input.martingaleEnabled,
          }),
          replayConfiguration,
        );

    const fusionReduced =
      new HistoricalShadowReplayEngine()
        .replay(
          history,
          new FusionReducedShadowAdapter(),
          replayConfiguration,
        );

    const heatmapDynamic =
      new HistoricalShadowReplayEngine()
        .replay(
          history,
          new HeatmapDynamicShadowAdapter(),
          replayConfiguration,
        );

    this.assertIndependentInitialBankroll(
      input.initialBankroll,
      [
        triplicacao,
        fusionReduced,
        heatmapDynamic,
      ],
    );

    return Object.freeze({
      totalSpins:
        history.length,

      initialBankroll:
        this.money(
          input.initialBankroll,
        ),

      provider:
        input.provider,

      riskMode:
        input.riskMode,

      minimumChipValue:
        this.money(
          input.minimumChipValue,
        ),

      martingaleEnabled:
        input.martingaleEnabled,

      triplicacao,

      fusionReduced,

      heatmapDynamic,

      summaries:
        Object.freeze([
          this.summary(
            triplicacao,
          ),

          this.summary(
            fusionReduced,
          ),

          this.summary(
            heatmapDynamic,
          ),
        ]),

      historicalShadow:
        true as const,

      retrospectiveOnly:
        true as const,

      lookAheadAllowed:
        false as const,

      realBankrollChanged:
        false as const,

      automaticExecution:
        false as const,

      humanExecutionRequired:
        true as const,
    });
  }


  private summary(
    replay:
      HistoricalShadowReplaySnapshot,
  ): PaperHistoricalShadowStrategySummary {
    return Object.freeze({
      strategyId:
        replay.strategyId,

      totalSpins:
        replay.totalSpins,

      tradeCount:
        replay.tradeCount,

      winCount:
        replay.winCount,

      lossCount:
        replay.lossCount,

      voidCount:
        replay.voidCount,

      hitRate:
        replay.hitRate,

      totalStake:
        replay.totalStake,

      totalPnl:
        replay.totalPnl,

      roiPercent:
        replay.roiPercent,

      initialBankroll:
        replay.initialBankroll,

      currentBankroll:
        replay.currentBankroll,

      bankrollReturnPercent:
        replay.bankrollReturnPercent,

      maxLossStreak:
        replay.maxLossStreak,

      maxDrawdownAmount:
        replay.maxDrawdownAmount,

      maxDrawdownPercent:
        replay.maxDrawdownPercent,

      capitalStop:
        replay.capitalStop,

      capitalStopReason:
        replay.capitalStopReason,

      noSignalDecisionPointCount:
        replay.noSignalDecisionPointCount,

      financiallyBlockedDecisionCount:
        replay.financiallyBlockedDecisionCount,

      capitalBlockedDecisionPointCount:
        replay.capitalBlockedDecisionPointCount,
    });
  }


  private assertIndependentInitialBankroll(
    expected:
      number,

    replays:
      readonly HistoricalShadowReplaySnapshot[],
  ): void {
    const normalizedExpected =
      this.money(
        expected,
      );

    for (
      const replay of
      replays
    ) {
      if (
        replay.initialBankroll !==
        normalizedExpected
      ) {
        throw new Error(
          'paper_historical_shadow_initial_bankroll_divergence',
        );
      }
    }
  }


  private validate(
    input:
      PaperHistoricalShadowSessionInput,
  ): void {
    if (
      !Array.isArray(
        input.history,
      )
    ) {
      throw new Error(
        'paper_historical_shadow_invalid_history',
      );
    }

    for (
      const spin of
      input.history
    ) {
      if (
        !Number.isInteger(
          spin,
        ) ||
        spin <
          0 ||
        spin >
          36
      ) {
        throw new Error(
          'paper_historical_shadow_invalid_spin',
        );
      }
    }

    if (
      !Number.isFinite(
        input.initialBankroll,
      ) ||
      input.initialBankroll <=
        0
    ) {
      throw new Error(
        'paper_historical_shadow_invalid_bankroll',
      );
    }

    if (
      input.riskMode !==
        'conservative' &&
      input.riskMode !==
        'moderate' &&
      input.riskMode !==
        'aggressive'
    ) {
      throw new Error(
        'paper_historical_shadow_invalid_risk_mode',
      );
    }

    if (
      input.provider !==
        'PRAGMATIC' &&
      input.provider !==
        'EVOLUTION'
    ) {
      throw new Error(
        'paper_historical_shadow_invalid_provider',
      );
    }

    if (
      !Number.isFinite(
        input.minimumChipValue,
      ) ||
      input.minimumChipValue <=
        0
    ) {
      throw new Error(
        'paper_historical_shadow_invalid_minimum_chip',
      );
    }

    if (
      typeof input.martingaleEnabled !==
        'boolean'
    ) {
      throw new Error(
        'paper_historical_shadow_invalid_martingale',
      );
    }
  }


  private money(
    value:
      number,
  ): number {
    return Math.round(
      value *
      100,
    ) /
    100;
  }
}
