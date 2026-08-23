import type {
  StrategyPaperStakePlanSnapshot,
} from './StrategyPaperStakePlan.js';


export interface StraightUpPaperFinancialSettlementInput {
  readonly strategyId:
    string;

  readonly targetNumbers:
    readonly number[];

  readonly resultNumber:
    number;

  readonly stakePlan:
    StrategyPaperStakePlanSnapshot;
}


export interface StraightUpPaperFinancialSettlementSnapshot {
  readonly strategyId:
    string;

  readonly currency:
    'BRL';

  readonly provider:
    string;

  readonly outcome:
    'WIN' |
    'LOSS';

  readonly resultNumber:
    number;

  readonly targetNumbers:
    readonly number[];

  readonly targetCount:
    number;

  readonly minimumChipValue:
    number;

  readonly chipsPerTarget:
    number;

  readonly stakePerTarget:
    number;

  readonly totalStake:
    number;

  /**
   * Inclui a devolução da stake vencedora.
   *
   * Número pleno:
   * 35:1 + unidade vencedora = 36 × stakePerTarget.
   */
  readonly grossReturn:
    number;

  readonly pnl:
    number;

  readonly paperOnly:
    true;

  readonly bankrollChanged:
    false;

  readonly automaticExecution:
    false;
}


/**
 * Financial settlement for equal straight-up number coverage.
 *
 * European roulette straight-up payout:
 *
 * WIN:
 * grossReturn = 36 × stakePerTarget
 * pnl = grossReturn - totalStake
 *
 * LOSS:
 * grossReturn = 0
 * pnl = -totalStake
 */
export class StraightUpPaperFinancialSettlement {
  public settle(
    input:
      StraightUpPaperFinancialSettlementInput,
  ): StraightUpPaperFinancialSettlementSnapshot {
    this.validateInput(
      input,
    );

    if (
      input.stakePlan.status !==
      'READY'
    ) {
      throw new Error(
        'straight_up_financial_stake_plan_not_ready',
      );
    }

    if (
      input.stakePlan.strategyId !==
      input.strategyId
    ) {
      throw new Error(
        'straight_up_financial_strategy_mismatch',
      );
    }

    if (
      input.stakePlan.targetCount !==
      input.targetNumbers.length
    ) {
      throw new Error(
        'straight_up_financial_target_count_mismatch',
      );
    }

    const hit =
      input.targetNumbers
        .includes(
          input.resultNumber,
        );

    const grossReturn =
      hit
        ? this.money(
            36 *
            input
              .stakePlan
              .stakePerTarget,
          )
        : 0;

    const pnl =
      this.money(
        grossReturn -
        input
          .stakePlan
          .totalStake,
      );

    return Object.freeze({
      strategyId:
        input.strategyId,

      currency:
        'BRL' as const,

      provider:
        input
          .stakePlan
          .provider,

      outcome:
        hit
          ? 'WIN' as const
          : 'LOSS' as const,

      resultNumber:
        input.resultNumber,

      targetNumbers:
        Object.freeze([
          ...input.targetNumbers,
        ]),

      targetCount:
        input.targetNumbers.length,

      minimumChipValue:
        input
          .stakePlan
          .minimumChipValue,

      chipsPerTarget:
        input
          .stakePlan
          .chipsPerTarget,

      stakePerTarget:
        input
          .stakePlan
          .stakePerTarget,

      totalStake:
        input
          .stakePlan
          .totalStake,

      grossReturn,

      pnl,

      paperOnly:
        true as const,

      bankrollChanged:
        false as const,

      automaticExecution:
        false as const,
    });
  }


  private validateInput(
    input:
      StraightUpPaperFinancialSettlementInput,
  ): void {
    if (
      !Number.isInteger(
        input.resultNumber,
      ) ||
      input.resultNumber <
        0 ||
      input.resultNumber >
        36
    ) {
      throw new Error(
        'straight_up_financial_invalid_result',
      );
    }

    if (
      !Array.isArray(
        input.targetNumbers,
      ) ||
      input.targetNumbers.length ===
        0
    ) {
      throw new Error(
        'straight_up_financial_invalid_targets',
      );
    }

    const unique =
      new Set<number>();

    for (
      const target of
      input.targetNumbers
    ) {
      if (
        !Number.isInteger(
          target,
        ) ||
        target <
          0 ||
        target >
          36
      ) {
        throw new Error(
          'straight_up_financial_invalid_target_number',
        );
      }

      unique.add(
        target,
      );
    }

    if (
      unique.size !==
      input.targetNumbers.length
    ) {
      throw new Error(
        'straight_up_financial_duplicate_target',
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
