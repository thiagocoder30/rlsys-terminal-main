import {
  PaperCapitalPreservationGuard,
  type PaperCapitalPreservationReport,
  type PaperCapitalRiskMode,
  type PaperCapitalStopReason,
} from './PaperCapitalPreservationGuard.js';


export type HistoricalShadowOutcome =
  | 'WIN'
  | 'LOSS'
  | 'VOID';


export type HistoricalShadowProvider =
  | 'PRAGMATIC'
  | 'EVOLUTION';


export interface HistoricalShadowReplayConfiguration {
  readonly initialBankroll:
    number;

  readonly riskMode:
    PaperCapitalRiskMode;

  readonly provider:
    HistoricalShadowProvider;

  readonly minimumChipValue:
    number;
}


export interface HistoricalShadowDecision {
  readonly strategyId:
    string;

  /**
   * Risk score da estratégia no instante histórico t.
   *
   * O adapter poderá entregá-lo posteriormente ao
   * PaperStakeRecommendationResolver.
   */
  readonly strategyRiskScore:
    number;

  readonly metadata?:
    Readonly<Record<string, unknown>>;
}


export interface HistoricalShadowFinancialContext {
  readonly initialBankroll:
    number;

  readonly currentBankroll:
    number;

  readonly peakBankroll:
    number;

  readonly riskMode:
    PaperCapitalRiskMode;

  readonly provider:
    HistoricalShadowProvider;

  readonly minimumChipValue:
    number;

  readonly capital:
    PaperCapitalPreservationReport;
}


export interface HistoricalShadowExecutableTrade {
  readonly strategyId:
    string;

  /**
   * Exposição TOTAL do trade, já quantizada e autorizada
   * pelas camadas financeiras da estratégia.
   */
  readonly stake:
    number;

  readonly metadata?:
    Readonly<Record<string, unknown>>;
}


export interface HistoricalShadowSettlement {
  readonly outcome:
    HistoricalShadowOutcome;

  readonly stake:
    number;

  /**
   * Retorno bruto, incluindo devolução da stake vencedora
   * quando aplicável.
   */
  readonly grossReturn:
    number;

  /**
   * P&L líquido do trade.
   */
  readonly pnl:
    number;

  readonly metadata?:
    Readonly<Record<string, unknown>>;
}


export interface HistoricalShadowStrategyAdapter {
  readonly strategyId:
    string;

  readonly minimumHistorySize:
    number;

  /**
   * Avalia exclusivamente history[0..t].
   *
   * O giro t+1 ainda não está acessível.
   */
  evaluate(
    visibleHistory:
      readonly number[],
  ): HistoricalShadowDecision | null;

  /**
   * Converte uma decisão estatística em um trade PAPER
   * financeiramente executável.
   *
   * Aqui cada adapter poderá utilizar:
   *
   * - PaperStakeRecommendationResolver;
   * - StrategyPaperStakePlan;
   * - contratos financeiros específicos da estratégia.
   *
   * null significa que havia sinal analítico, mas nenhuma
   * exposição financeira segura/executável pôde ser criada.
   */
  prepare(
    decision:
      HistoricalShadowDecision,

    context:
      HistoricalShadowFinancialContext,
  ): HistoricalShadowExecutableTrade | null;

  /**
   * Liquida exclusivamente com o giro imediatamente seguinte.
   */
  settle(
    trade:
      HistoricalShadowExecutableTrade,

    nextSpin:
      number,
  ): HistoricalShadowSettlement;
}


export interface HistoricalShadowTrade {
  readonly tradeIndex:
    number;

  readonly decisionSpinIndex:
    number;

  readonly settlementSpinIndex:
    number;

  readonly decisionHistorySize:
    number;

  readonly decisionSpin:
    number;

  readonly settlementSpin:
    number;

  readonly bankrollBefore:
    number;

  readonly bankrollAfter:
    number;

  readonly peakBankrollAfter:
    number;

  readonly decision:
    HistoricalShadowDecision;

  readonly executableTrade:
    HistoricalShadowExecutableTrade;

  readonly settlement:
    HistoricalShadowSettlement;

  readonly cumulativePnl:
    number;

  readonly drawdownAmount:
    number;
}


export interface HistoricalShadowReplaySnapshot {
  readonly strategyId:
    string;

  readonly provider:
    HistoricalShadowProvider;

  readonly minimumChipValue:
    number;

  readonly riskMode:
    PaperCapitalRiskMode;

  readonly totalSpins:
    number;

  readonly minimumHistorySize:
    number;

  readonly warmupSpins:
    number;

  /**
   * Todos os pontos cronologicamente possíveis depois do warm-up.
   */
  readonly decisionPointCount:
    number;

  /**
   * Pontos realmente avaliados antes de eventual STOP.
   */
  readonly evaluatedDecisionPointCount:
    number;

  /**
   * Pontos restantes que não foram avaliados porque Capital
   * Preservation já havia determinado STOP.
   */
  readonly capitalBlockedDecisionPointCount:
    number;

  /**
   * Pontos avaliados nos quais a estratégia não gerou sinal.
   */
  readonly noSignalDecisionPointCount:
    number;

  /**
   * Houve sinal, mas sizing/layout financeiro bloqueou.
   */
  readonly financiallyBlockedDecisionCount:
    number;

  readonly tradeCount:
    number;

  readonly winCount:
    number;

  readonly lossCount:
    number;

  readonly voidCount:
    number;

  readonly decisiveTradeCount:
    number;

  readonly hitRate:
    number | null;

  readonly totalStake:
    number;

  readonly grossReturn:
    number;

  readonly totalPnl:
    number;

  readonly roiPercent:
    number | null;

  readonly averagePnlPerTrade:
    number | null;

  readonly initialBankroll:
    number;

  readonly currentBankroll:
    number;

  readonly peakBankroll:
    number;

  readonly bankrollReturnPercent:
    number;

  readonly maxLossStreak:
    number;

  readonly maxDrawdownAmount:
    number;

  readonly maxDrawdownPercent:
    number;

  readonly capitalDecision:
    PaperCapitalPreservationReport['decision'];

  readonly capitalStop:
    boolean;

  readonly capitalStopReason:
    PaperCapitalStopReason | null;

  readonly capitalStopDecisionSpinIndex:
    number | null;

  readonly trades:
    readonly HistoricalShadowTrade[];

  readonly historicalShadow:
    true;

  readonly lookAheadAllowed:
    false;

  readonly paperOnly:
    true;

  readonly recommendationOnly:
    true;

  readonly humanExecutionRequired:
    true;

  readonly bankrollChangedInSimulationOnly:
    true;

  readonly realBankrollChanged:
    false;

  readonly automaticExecution:
    false;
}


/**
 * Chronological bankroll-aware historical SHADOW replay.
 *
 * Sovereign responsibilities:
 *
 * - temporal chronology;
 * - prevention of look-ahead;
 * - simulated bankroll state;
 * - simulated peak bankroll;
 * - invocation of Capital Preservation before each decision;
 * - accumulation of financial outcomes.
 *
 * It does NOT own:
 *
 * - strategy mathematics;
 * - strategy triggers;
 * - stake sizing;
 * - physical bet layout;
 * - payout semantics.
 *
 * Those responsibilities remain in the strategy adapters.
 */
export class HistoricalShadowReplayEngine {
  public constructor(
    private readonly capitalGuard:
      PaperCapitalPreservationGuard =
        new PaperCapitalPreservationGuard(),
  ) {}


  public replay(
    history:
      readonly number[],

    adapter:
      HistoricalShadowStrategyAdapter,

    configuration:
      HistoricalShadowReplayConfiguration,
  ): HistoricalShadowReplaySnapshot {
    this.validateHistory(
      history,
    );

    this.validateAdapter(
      adapter,
    );

    this.validateConfiguration(
      configuration,
    );

    const totalSpins =
      history.length;

    const minimumHistorySize =
      adapter.minimumHistorySize;

    const warmupSpins =
      Math.min(
        totalSpins,
        minimumHistorySize,
      );

    const decisionPointCount =
      Math.max(
        0,
        totalSpins -
        minimumHistorySize,
      );

    const initialBankroll =
      this.money(
        configuration.initialBankroll,
      );

    let currentBankroll =
      initialBankroll;

    let peakBankroll =
      initialBankroll;

    let evaluatedDecisionPointCount =
      0;

    let noSignalDecisionPointCount =
      0;

    let financiallyBlockedDecisionCount =
      0;

    let capitalBlockedDecisionPointCount =
      0;

    let capitalStopReason:
      PaperCapitalStopReason | null =
      null;

    let capitalStopDecisionSpinIndex:
      number | null =
      null;

    let maxDrawdownAmount =
      0;

    let maxDrawdownPercent =
      0;

    const trades:
      HistoricalShadowTrade[] =
      [];


    for (
      let visibleSize =
        minimumHistorySize;
      visibleSize <
        totalSpins;
      visibleSize +=
        1
    ) {
      /*
       * Capital Preservation always executes before:
       *
       * - analytical recommendation;
       * - stake sizing;
       * - financial exposure.
       */
      const capital =
        this.capitalGuard
          .evaluate({
            initialBankroll,

            currentBankroll,

            peakBankroll,

            riskMode:
              configuration.riskMode,
          });

      if (
        !capital.newRecommendationsAllowed ||
        !capital.bankrollExposureAllowed ||
        capital.decision ===
          'STOP'
      ) {
        capitalStopReason =
          capital.stopReason;

        capitalStopDecisionSpinIndex =
          visibleSize -
          1;

        /*
         * Current point + every subsequent possible point.
         */
        capitalBlockedDecisionPointCount =
          totalSpins -
          visibleSize;

        break;
      }

      evaluatedDecisionPointCount +=
        1;

      /*
       * CRITICAL ANTI-LOOK-AHEAD BOUNDARY.
       *
       * history[visibleSize] is the future settlement spin
       * and is deliberately absent here.
       */
      const visibleHistory =
        Object.freeze(
          history.slice(
            0,
            visibleSize,
          ),
        );

      const decision =
        adapter.evaluate(
          visibleHistory,
        );

      if (
        decision ===
        null
      ) {
        noSignalDecisionPointCount +=
          1;

        continue;
      }

      this.validateDecision(
        decision,
        adapter,
      );

      const executableTrade =
        adapter.prepare(
          decision,
          Object.freeze({
            initialBankroll,

            currentBankroll,

            peakBankroll,

            riskMode:
              configuration.riskMode,

            provider:
              configuration.provider,

            minimumChipValue:
              configuration
                .minimumChipValue,

            capital,
          }),
        );

      if (
        executableTrade ===
        null
      ) {
        financiallyBlockedDecisionCount +=
          1;

        continue;
      }

      this.validateExecutableTrade(
        executableTrade,
        adapter,
        currentBankroll,
      );

      const settlementSpin =
        history[
          visibleSize
        ];

      const settlement =
        adapter.settle(
          executableTrade,
          settlementSpin,
        );

      this.validateSettlement(
        settlement,
        executableTrade,
      );

      const bankrollBefore =
        currentBankroll;

      currentBankroll =
        this.money(
          currentBankroll +
          settlement.pnl,
        );

      if (
        currentBankroll <
        0
      ) {
        throw new Error(
          'historical_shadow_negative_bankroll',
        );
      }

      peakBankroll =
        this.money(
          Math.max(
            peakBankroll,
            currentBankroll,
          ),
        );

      const drawdownAmount =
        this.money(
          Math.max(
            0,
            peakBankroll -
            currentBankroll,
          ),
        );

      const drawdownPercent =
        peakBankroll >
          0
          ? this.round4(
              (
                drawdownAmount /
                peakBankroll
              ) *
              100,
            )
          : 0;

      maxDrawdownAmount =
        Math.max(
          maxDrawdownAmount,
          drawdownAmount,
        );

      maxDrawdownPercent =
        Math.max(
          maxDrawdownPercent,
          drawdownPercent,
        );

      trades.push(
        Object.freeze({
          tradeIndex:
            trades.length +
            1,

          decisionSpinIndex:
            visibleSize -
            1,

          settlementSpinIndex:
            visibleSize,

          decisionHistorySize:
            visibleSize,

          decisionSpin:
            history[
              visibleSize -
              1
            ],

          settlementSpin,

          bankrollBefore,

          bankrollAfter:
            currentBankroll,

          peakBankrollAfter:
            peakBankroll,

          decision:
            Object.freeze({
              ...decision,
            }),

          executableTrade:
            Object.freeze({
              ...executableTrade,
            }),

          settlement:
            Object.freeze({
              ...settlement,
            }),

          cumulativePnl:
            this.money(
              currentBankroll -
              initialBankroll,
            ),

          drawdownAmount,
        }),
      );
    }


    const finalCapital =
      this.capitalGuard
        .evaluate({
          initialBankroll,

          currentBankroll,

          peakBankroll,

          riskMode:
            configuration.riskMode,
        });

    if (
      capitalStopReason ===
        null &&
      finalCapital.decision ===
        'STOP'
    ) {
      capitalStopReason =
        finalCapital.stopReason;

      /*
       * No future decision point may exist in the supplied
       * history, so this is terminal state rather than an
       * internally blocked historical point.
       */
      capitalStopDecisionSpinIndex =
        totalSpins >
          0
          ? totalSpins -
            1
          : null;
    }


    const winCount =
      this.countOutcome(
        trades,
        'WIN',
      );

    const lossCount =
      this.countOutcome(
        trades,
        'LOSS',
      );

    const voidCount =
      this.countOutcome(
        trades,
        'VOID',
      );

    const decisiveTradeCount =
      winCount +
      lossCount;

    const totalStake =
      this.money(
        trades.reduce(
          (
            sum,
            trade,
          ) =>
            sum +
            trade
              .settlement
              .stake,
          0,
        ),
      );

    const grossReturn =
      this.money(
        trades.reduce(
          (
            sum,
            trade,
          ) =>
            sum +
            trade
              .settlement
              .grossReturn,
          0,
        ),
      );

    const totalPnl =
      this.money(
        currentBankroll -
        initialBankroll,
      );


    return Object.freeze({
      strategyId:
        adapter.strategyId,

      provider:
        configuration.provider,

      minimumChipValue:
        this.money(
          configuration
            .minimumChipValue,
        ),

      riskMode:
        configuration.riskMode,

      totalSpins,

      minimumHistorySize,

      warmupSpins,

      decisionPointCount,

      evaluatedDecisionPointCount,

      capitalBlockedDecisionPointCount,

      noSignalDecisionPointCount,

      financiallyBlockedDecisionCount,

      tradeCount:
        trades.length,

      winCount,

      lossCount,

      voidCount,

      decisiveTradeCount,

      hitRate:
        decisiveTradeCount ===
          0
          ? null
          : this.round4(
              winCount /
              decisiveTradeCount,
            ),

      totalStake,

      grossReturn,

      totalPnl,

      roiPercent:
        totalStake ===
          0
          ? null
          : this.round4(
              (
                totalPnl /
                totalStake
              ) *
              100,
            ),

      averagePnlPerTrade:
        trades.length ===
          0
          ? null
          : this.money(
              totalPnl /
              trades.length,
            ),

      initialBankroll,

      currentBankroll,

      peakBankroll,

      bankrollReturnPercent:
        this.round4(
          (
            totalPnl /
            initialBankroll
          ) *
          100,
        ),

      maxLossStreak:
        this.maxLossStreak(
          trades,
        ),

      maxDrawdownAmount:
        this.money(
          maxDrawdownAmount,
        ),

      maxDrawdownPercent:
        this.round4(
          maxDrawdownPercent,
        ),

      capitalDecision:
        finalCapital.decision,

      capitalStop:
        finalCapital.decision ===
        'STOP',

      capitalStopReason,

      capitalStopDecisionSpinIndex,

      trades:
        Object.freeze([
          ...trades,
        ]),

      historicalShadow:
        true as const,

      lookAheadAllowed:
        false as const,

      paperOnly:
        true as const,

      recommendationOnly:
        true as const,

      humanExecutionRequired:
        true as const,

      bankrollChangedInSimulationOnly:
        true as const,

      realBankrollChanged:
        false as const,

      automaticExecution:
        false as const,
    });
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
        'historical_shadow_invalid_history',
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
      spin <
        0 ||
      spin >
        36
      ) {
        throw new Error(
          'historical_shadow_invalid_spin',
        );
      }
    }
  }


  private validateAdapter(
    adapter:
      HistoricalShadowStrategyAdapter,
  ): void {
    if (
      typeof adapter.strategyId !==
        'string' ||
      adapter.strategyId
        .trim()
        .length ===
        0
    ) {
      throw new Error(
        'historical_shadow_invalid_strategy_id',
      );
    }

    if (
      !Number.isInteger(
        adapter.minimumHistorySize,
      ) ||
      adapter.minimumHistorySize <
        1
    ) {
      throw new Error(
        'historical_shadow_invalid_minimum_history_size',
      );
    }

    if (
      typeof adapter.evaluate !==
        'function' ||
      typeof adapter.prepare !==
        'function' ||
      typeof adapter.settle !==
        'function'
    ) {
      throw new Error(
        'historical_shadow_invalid_adapter',
      );
    }
  }


  private validateConfiguration(
    configuration:
      HistoricalShadowReplayConfiguration,
  ): void {
    if (
      !Number.isFinite(
        configuration.initialBankroll,
      ) ||
      configuration.initialBankroll <=
        0
    ) {
      throw new Error(
        'historical_shadow_invalid_initial_bankroll',
      );
    }

    if (
      configuration.riskMode !==
        'conservative' &&
      configuration.riskMode !==
        'moderate' &&
      configuration.riskMode !==
        'aggressive'
    ) {
      throw new Error(
        'historical_shadow_invalid_risk_mode',
      );
    }

    if (
      configuration.provider !==
        'PRAGMATIC' &&
      configuration.provider !==
        'EVOLUTION'
    ) {
      throw new Error(
        'historical_shadow_invalid_provider',
      );
    }

    if (
      !Number.isFinite(
        configuration.minimumChipValue,
      ) ||
      configuration.minimumChipValue <=
        0
    ) {
      throw new Error(
        'historical_shadow_invalid_minimum_chip',
      );
    }
  }


  private validateDecision(
    decision:
      HistoricalShadowDecision,

    adapter:
      HistoricalShadowStrategyAdapter,
  ): void {
    if (
      decision.strategyId !==
      adapter.strategyId
    ) {
      throw new Error(
        'historical_shadow_decision_strategy_mismatch',
      );
    }

    if (
      !Number.isFinite(
        decision.strategyRiskScore,
      ) ||
      decision.strategyRiskScore <
        0 ||
      decision.strategyRiskScore >
        1
    ) {
      throw new Error(
        'historical_shadow_invalid_strategy_risk',
      );
    }
  }


  private validateExecutableTrade(
    trade:
      HistoricalShadowExecutableTrade,

    adapter:
      HistoricalShadowStrategyAdapter,

    currentBankroll:
      number,
  ): void {
    if (
      trade.strategyId !==
      adapter.strategyId
    ) {
      throw new Error(
        'historical_shadow_trade_strategy_mismatch',
      );
    }

    if (
      !Number.isFinite(
        trade.stake,
      ) ||
      trade.stake <=
        0
    ) {
      throw new Error(
        'historical_shadow_invalid_trade_stake',
      );
    }

    if (
      trade.stake >
      currentBankroll +
      Number.EPSILON
    ) {
      throw new Error(
        'historical_shadow_trade_exceeds_bankroll',
      );
    }
  }


  private validateSettlement(
    settlement:
      HistoricalShadowSettlement,

    trade:
      HistoricalShadowExecutableTrade,
  ): void {
    if (
      settlement.outcome !==
        'WIN' &&
      settlement.outcome !==
        'LOSS' &&
      settlement.outcome !==
        'VOID'
    ) {
      throw new Error(
        'historical_shadow_invalid_outcome',
      );
    }

    if (
      !Number.isFinite(
        settlement.stake,
      ) ||
      settlement.stake <=
        0
    ) {
      throw new Error(
        'historical_shadow_invalid_settlement_stake',
      );
    }

    if (
      Math.abs(
        settlement.stake -
        trade.stake,
      ) >
      0.001
    ) {
      throw new Error(
        'historical_shadow_settlement_stake_mismatch',
      );
    }

    if (
      !Number.isFinite(
        settlement.grossReturn,
      ) ||
      settlement.grossReturn <
        0
    ) {
      throw new Error(
        'historical_shadow_invalid_gross_return',
      );
    }

    if (
      !Number.isFinite(
        settlement.pnl,
      )
    ) {
      throw new Error(
        'historical_shadow_invalid_pnl',
      );
    }

    /*
     * A normal PAPER trade cannot lose more than its
     * explicitly exposed stake.
     */
    if (
      settlement.pnl <
      -settlement.stake -
      0.001
    ) {
      throw new Error(
        'historical_shadow_loss_exceeds_stake',
      );
    }
  }


  private countOutcome(
    trades:
      readonly HistoricalShadowTrade[],

    outcome:
      HistoricalShadowOutcome,
  ): number {
    return trades.filter(
      (
        trade,
      ) =>
        trade
          .settlement
          .outcome ===
        outcome,
    ).length;
  }


  private maxLossStreak(
    trades:
      readonly HistoricalShadowTrade[],
  ): number {
    let current =
      0;

    let maximum =
      0;

    for (
      const trade of
      trades
    ) {
      if (
        trade
          .settlement
          .outcome ===
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
        trade
          .settlement
          .outcome ===
        'WIN'
      ) {
        current =
          0;
      }
    }

    return maximum;
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


  private round4(
    value:
      number,
  ): number {
    return Number(
      value.toFixed(
        4,
      ),
    );
  }
}
