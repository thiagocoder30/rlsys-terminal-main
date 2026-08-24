import {
  PaperBaseExposureRiskPolicy,
} from './PaperBaseExposureRiskPolicy.js';

import {
  PaperCapitalPreservationGuard,
  type PaperCapitalPreservationReport,
  type PaperCapitalRiskMode,
} from './PaperCapitalPreservationGuard.js';


export type PaperProspectivePortfolioStrategyId =
  | 'triplicacao'
  | 'fusion-reduced'
  | 'heatmap-dynamic';


export type PaperProspectivePortfolioDecision =
  | 'APPROVED'
  | 'BLOCKED';


export type PaperProspectivePortfolioSettlementOutcome =
  | 'WIN'
  | 'LOSS'
  | 'VOID';


export interface PaperProspectivePortfolioConfiguration {
  readonly initialBankroll:
    number;

  readonly riskMode:
    PaperCapitalRiskMode;
}


export interface PaperProspectivePortfolioExposureRequest {
  readonly strategyId:
    PaperProspectivePortfolioStrategyId;

  readonly requestedStake:
    number;
}


export interface PaperProspectivePortfolioExposureReservation {
  readonly decision:
    PaperProspectivePortfolioDecision;

  readonly strategyId:
    PaperProspectivePortfolioStrategyId;

  readonly requestedStake:
    number;

  readonly approvedStake:
    number | null;

  readonly currentBankroll:
    number;

  readonly exposureLimitFraction:
    number;

  readonly maximumAggregateExposure:
    number;

  readonly aggregateExposureBefore:
    number;

  readonly aggregateExposureAfter:
    number;

  readonly availableExposureBefore:
    number;

  readonly capital:
    PaperCapitalPreservationReport;

  readonly blocker:
    string | null;

  readonly recommendationOnly:
    true;

  readonly humanExecutionRequired:
    true;

  readonly automaticBetExecutionAllowed:
    false;
}


export interface PaperProspectivePortfolioSettlementInput {
  readonly strategyId:
    PaperProspectivePortfolioStrategyId;

  readonly outcome:
    PaperProspectivePortfolioSettlementOutcome;

  readonly pnl:
    number;
}


export interface PaperProspectivePortfolioSettlementReport {
  readonly strategyId:
    PaperProspectivePortfolioStrategyId;

  readonly outcome:
    PaperProspectivePortfolioSettlementOutcome;

  readonly releasedExposure:
    number;

  readonly pnl:
    number;

  readonly bankrollBefore:
    number;

  readonly bankrollAfter:
    number;

  readonly peakBankroll:
    number;

  readonly aggregateExposureAfter:
    number;

  readonly capital:
    PaperCapitalPreservationReport;

  readonly recommendationOnly:
    true;

  readonly humanExecutionRequired:
    true;

  readonly automaticBetExecutionAllowed:
    false;
}


export interface PaperProspectivePortfolioPendingExposure {
  readonly strategyId:
    PaperProspectivePortfolioStrategyId;

  readonly stake:
    number;
}


export interface PaperProspectivePortfolioSnapshot {
  readonly initialBankroll:
    number;

  readonly currentBankroll:
    number;

  readonly peakBankroll:
    number;

  readonly riskMode:
    PaperCapitalRiskMode;

  readonly exposureLimitFraction:
    number;

  readonly maximumAggregateExposure:
    number;

  readonly aggregateExposure:
    number;

  readonly availableExposure:
    number;

  readonly pending:
    readonly PaperProspectivePortfolioPendingExposure[];

  readonly capital:
    PaperCapitalPreservationReport;

  readonly recommendationOnly:
    true;

  readonly humanExecutionRequired:
    true;

  readonly automaticBetExecutionAllowed:
    false;
}


/**
 * Sovereign financial boundary for one prospective PAPER session.
 *
 * Authority hierarchy:
 *
 * PaperCapitalPreservationGuard
 *          ↓
 * PaperBaseExposureRiskPolicy
 *          ↓
 * aggregate portfolio reservations
 *
 * One bankroll.
 * One peak.
 * One capital state.
 * One simultaneous BASE exposure ceiling.
 *
 * Strategies do not own independent prospective bankrolls.
 *
 * Kelly, recovery and strategy confidence may reduce exposure or
 * request exposure, but cannot override this aggregate boundary.
 *
 * Nothing here performs an external bet.
 */
export class PaperProspectivePortfolioRiskController {
  private readonly initialBankroll:
    number;

  private currentBankroll:
    number;

  private peakBankroll:
    number;

  private readonly riskMode:
    PaperCapitalRiskMode;

  private readonly exposureLimitFraction:
    number;

  private readonly pending =
    new Map<
      PaperProspectivePortfolioStrategyId,
      number
    >();


  private readonly exposurePolicy =
    new PaperBaseExposureRiskPolicy();

  private readonly capitalGuard =
    new PaperCapitalPreservationGuard();


  public constructor(
    configuration:
      PaperProspectivePortfolioConfiguration,
  ) {
    this.validateConfiguration(
      configuration,
    );

    this.initialBankroll =
      this.money(
        configuration.initialBankroll,
      );

    this.currentBankroll =
      this.initialBankroll;

    this.peakBankroll =
      this.initialBankroll;

    this.riskMode =
      configuration.riskMode;

    this.exposureLimitFraction =
      this.exposurePolicy
        .resolve(
          this.riskMode,
        )
        .exposureFraction;
  }


  public reserve(
    input:
      PaperProspectivePortfolioExposureRequest,
  ): PaperProspectivePortfolioExposureReservation {
    this.validateStrategyId(
      input.strategyId,
    );

    this.validateStake(
      input.requestedStake,
    );

    const capital =
      this.evaluateCapital();

    const requestedStake =
      this.money(
        input.requestedStake,
      );

    const aggregateBefore =
      this.aggregateExposure();

    const maximumExposure =
      this.maximumAggregateExposure();

    const availableBefore =
      this.availableExposure(
        maximumExposure,
        aggregateBefore,
      );

    if (
      !capital.newRecommendationsAllowed ||
      !capital.bankrollExposureAllowed
    ) {
      return this.reservation({
        decision:
          'BLOCKED',

        strategyId:
          input.strategyId,

        requestedStake,

        approvedStake:
          null,

        maximumExposure,

        aggregateBefore,

        aggregateAfter:
          aggregateBefore,

        availableBefore,

        capital,

        blocker:
          'CAPITAL_PRESERVATION_BLOCKED',
      });
    }

    if (
      this.pending.has(
        input.strategyId,
      )
    ) {
      return this.reservation({
        decision:
          'BLOCKED',

        strategyId:
          input.strategyId,

        requestedStake,

        approvedStake:
          null,

        maximumExposure,

        aggregateBefore,

        aggregateAfter:
          aggregateBefore,

        availableBefore,

        capital,

        blocker:
          'STRATEGY_EXPOSURE_ALREADY_PENDING',
      });
    }

    if (
      requestedStake >
      availableBefore +
      1e-9
    ) {
      return this.reservation({
        decision:
          'BLOCKED',

        strategyId:
          input.strategyId,

        requestedStake,

        approvedStake:
          null,

        maximumExposure,

        aggregateBefore,

        aggregateAfter:
          aggregateBefore,

        availableBefore,

        capital,

        blocker:
          'PORTFOLIO_EXPOSURE_LIMIT_EXCEEDED',
      });
    }

    this.pending.set(
      input.strategyId,
      requestedStake,
    );

    return this.reservation({
      decision:
        'APPROVED',

      strategyId:
        input.strategyId,

      requestedStake,

      approvedStake:
        requestedStake,

      maximumExposure,

      aggregateBefore,

      aggregateAfter:
        this.aggregateExposure(),

      availableBefore,

      capital,

      blocker:
        null,
    });
  }


  public settle(
    input:
      PaperProspectivePortfolioSettlementInput,
  ): PaperProspectivePortfolioSettlementReport {
    this.validateStrategyId(
      input.strategyId,
    );

    this.validateOutcome(
      input.outcome,
    );

    this.validatePnl(
      input.pnl,
    );

    const reserved =
      this.pending.get(
        input.strategyId,
      );

    if (
      reserved ===
      undefined
    ) {
      throw new Error(
        'paper_portfolio_settlement_without_pending_exposure',
      );
    }

    const pnl =
      this.money(
        input.pnl,
      );

    if (
      input.outcome ===
        'VOID' &&
      pnl !==
        0
    ) {
      throw new Error(
        'paper_portfolio_void_with_non_zero_pnl',
      );
    }

    if (
      input.outcome ===
        'WIN' &&
      pnl <
        0
    ) {
      throw new Error(
        'paper_portfolio_win_with_negative_pnl',
      );
    }

    if (
      input.outcome ===
        'LOSS' &&
      pnl >
        0
    ) {
      throw new Error(
        'paper_portfolio_loss_with_positive_pnl',
      );
    }

    const bankrollBefore =
      this.currentBankroll;

    const bankrollAfter =
      this.money(
        bankrollBefore +
        pnl,
      );

    if (
      bankrollAfter <
      0
    ) {
      throw new Error(
        'paper_portfolio_bankroll_negative',
      );
    }

    this.pending.delete(
      input.strategyId,
    );

    this.currentBankroll =
      bankrollAfter;

    this.peakBankroll =
      this.money(
        Math.max(
          this.peakBankroll,
          this.currentBankroll,
        ),
      );

    const capital =
      this.evaluateCapital();

    return Object.freeze({
      strategyId:
        input.strategyId,

      outcome:
        input.outcome,

      releasedExposure:
        reserved,

      pnl,

      bankrollBefore,

      bankrollAfter:
        this.currentBankroll,

      peakBankroll:
        this.peakBankroll,

      aggregateExposureAfter:
        this.aggregateExposure(),

      capital,

      recommendationOnly:
        true as const,

      humanExecutionRequired:
        true as const,

      automaticBetExecutionAllowed:
        false as const,
    });
  }


  public release(
    strategyId:
      PaperProspectivePortfolioStrategyId,
  ): PaperProspectivePortfolioSnapshot {
    this.validateStrategyId(
      strategyId,
    );

    this.pending.delete(
      strategyId,
    );

    return this.snapshot();
  }


  public snapshot():
    PaperProspectivePortfolioSnapshot {
    const maximumExposure =
      this.maximumAggregateExposure();

    const aggregateExposure =
      this.aggregateExposure();

    return Object.freeze({
      initialBankroll:
        this.initialBankroll,

      currentBankroll:
        this.currentBankroll,

      peakBankroll:
        this.peakBankroll,

      riskMode:
        this.riskMode,

      exposureLimitFraction:
        this.exposureLimitFraction,

      maximumAggregateExposure:
        maximumExposure,

      aggregateExposure,

      availableExposure:
        this.availableExposure(
          maximumExposure,
          aggregateExposure,
        ),

      pending:
        Object.freeze(
          Array.from(
            this.pending.entries(),
          ).map(
            (
              [
                strategyId,
                stake,
              ],
            ) =>
              Object.freeze({
                strategyId,
                stake,
              }),
          ),
        ),

      capital:
        this.evaluateCapital(),

      recommendationOnly:
        true as const,

      humanExecutionRequired:
        true as const,

      automaticBetExecutionAllowed:
        false as const,
    });
  }


  private evaluateCapital():
    PaperCapitalPreservationReport {
    return this.capitalGuard.evaluate({
      initialBankroll:
        this.initialBankroll,

      currentBankroll:
        this.currentBankroll,

      peakBankroll:
        this.peakBankroll,

      riskMode:
        this.riskMode,
    });
  }


  /**
   * Hard risk ceilings are always rounded DOWN.
   *
   * Example:
   *
   * bankroll 119.80 × 2% = 2.396
   *
   * sovereign portfolio ceiling = 2.39,
   * never R$ 2.40.
   */
  private maximumAggregateExposure():
    number {
    return this.floorMoney(
      this.currentBankroll *
      this.exposureLimitFraction,
    );
  }


  private aggregateExposure():
    number {
    return this.money(
      Array.from(
        this.pending.values(),
      ).reduce(
        (
          total,
          stake,
        ) =>
          total +
          stake,
        0,
      ),
    );
  }


  private availableExposure(
    maximumExposure:
      number,

    aggregateExposure:
      number,
  ): number {
    return this.money(
      Math.max(
        0,
        maximumExposure -
        aggregateExposure,
      ),
    );
  }


  private reservation(
    input: {
      readonly decision:
        PaperProspectivePortfolioDecision;

      readonly strategyId:
        PaperProspectivePortfolioStrategyId;

      readonly requestedStake:
        number;

      readonly approvedStake:
        number | null;

      readonly maximumExposure:
        number;

      readonly aggregateBefore:
        number;

      readonly aggregateAfter:
        number;

      readonly availableBefore:
        number;

      readonly capital:
        PaperCapitalPreservationReport;

      readonly blocker:
        string | null;
    },
  ): PaperProspectivePortfolioExposureReservation {
    return Object.freeze({
      decision:
        input.decision,

      strategyId:
        input.strategyId,

      requestedStake:
        input.requestedStake,

      approvedStake:
        input.approvedStake,

      currentBankroll:
        this.currentBankroll,

      exposureLimitFraction:
        this.exposureLimitFraction,

      maximumAggregateExposure:
        input.maximumExposure,

      aggregateExposureBefore:
        input.aggregateBefore,

      aggregateExposureAfter:
        input.aggregateAfter,

      availableExposureBefore:
        input.availableBefore,

      capital:
        input.capital,

      blocker:
        input.blocker,

      recommendationOnly:
        true as const,

      humanExecutionRequired:
        true as const,

      automaticBetExecutionAllowed:
        false as const,
    });
  }


  private validateConfiguration(
    configuration:
      PaperProspectivePortfolioConfiguration,
  ): void {
    if (
      !Number.isFinite(
        configuration.initialBankroll,
      ) ||
      configuration.initialBankroll <=
        0
    ) {
      throw new Error(
        'paper_portfolio_invalid_initial_bankroll',
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
        'paper_portfolio_invalid_risk_mode',
      );
    }
  }


  private validateStrategyId(
    strategyId:
      PaperProspectivePortfolioStrategyId,
  ): void {
    if (
      strategyId !==
        'triplicacao' &&
      strategyId !==
        'fusion-reduced' &&
      strategyId !==
        'heatmap-dynamic'
    ) {
      throw new Error(
        'paper_portfolio_invalid_strategy',
      );
    }
  }


  private validateStake(
    stake:
      number,
  ): void {
    if (
      !Number.isFinite(
        stake,
      ) ||
      stake <=
        0
    ) {
      throw new Error(
        'paper_portfolio_invalid_requested_stake',
      );
    }
  }


  private validateOutcome(
    outcome:
      PaperProspectivePortfolioSettlementOutcome,
  ): void {
    if (
      outcome !==
        'WIN' &&
      outcome !==
        'LOSS' &&
      outcome !==
        'VOID'
    ) {
      throw new Error(
        'paper_portfolio_invalid_settlement_outcome',
      );
    }
  }


  private validatePnl(
    pnl:
      number,
  ): void {
    if (
      !Number.isFinite(
        pnl,
      )
    ) {
      throw new Error(
        'paper_portfolio_invalid_pnl',
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


  private floorMoney(
    value:
      number,
  ): number {
    return Math.floor(
      (
        value +
        1e-9
      ) *
      100,
    ) /
    100;
  }
}
