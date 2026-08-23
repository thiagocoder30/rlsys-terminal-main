import type {
  PaperOperatorProvider,
} from './PaperSessionOperatorConfiguration.js';


export type StrategyPaperStakePlanStatus =
  | 'READY'
  | 'BLOCKED';


export interface StrategyPaperStakePlanInput {
  readonly strategyId:
    string;

  readonly provider:
    PaperOperatorProvider;

  /**
   * Granularidade monetária já resolvida pela configuração
   * canônica da sessão PAPER.
   *
   * Atualmente:
   *
   * PRAGMATIC = R$ 0,10
   * EVOLUTION = R$ 0,50
   */
  readonly minimumChipValue:
    number;

  /**
   * Quantidade de posições simultâneas que precisam receber
   * exatamente o mesmo valor.
   *
   * Fusion Reduzida = 19.
   * Heatmap Dynamic = variável.
   */
  readonly targetCount:
    number;

  /**
   * Exposição TOTAL máxima autorizada pela camada soberana
   * de risco.
   *
   * Este componente jamais pode exceder esse valor.
   */
  readonly maximumTotalStake:
    number;
}


export interface StrategyPaperStakePlanSnapshot {
  readonly strategyId:
    string;

  readonly status:
    StrategyPaperStakePlanStatus;

  readonly provider:
    PaperOperatorProvider;

  readonly currency:
    'BRL';

  readonly minimumChipValue:
    number;

  readonly targetCount:
    number;

  readonly maximumTotalStake:
    number;

  readonly minimumExecutableTotalStake:
    number;

  readonly chipsPerTarget:
    number;

  readonly stakePerTarget:
    number;

  readonly totalStake:
    number;

  readonly unusedBudget:
    number;

  readonly blocker:
    string | null;

  readonly paperOnly:
    true;

  readonly recommendationOnly:
    true;

  readonly humanExecutionRequired:
    true;

  readonly automaticExecutionAllowed:
    false;
}


/**
 * Physical-layout quantizer for multi-target PAPER strategies.
 *
 * IMPORTANT:
 *
 * This class is NOT a stake authority.
 *
 * It receives maximumTotalStake already authorized by the
 * sovereign financial/risk layer and converts that budget into
 * an executable equal-value layout.
 *
 * It may:
 * - reduce exposure because of chip granularity;
 * - block an impossible layout.
 *
 * It may NEVER:
 * - increase the authorized financial budget;
 * - calculate bankroll risk;
 * - bypass capital preservation;
 * - execute a bet.
 */
export class StrategyPaperStakePlan {
  public resolve(
    input:
      StrategyPaperStakePlanInput,
  ): StrategyPaperStakePlanSnapshot {
    this.validateInput(
      input,
    );

    const chip =
      this.money(
        input.minimumChipValue,
      );

    const maximumTotalStake =
      this.money(
        input.maximumTotalStake,
      );

    const minimumExecutableTotalStake =
      this.money(
        chip *
        input.targetCount,
      );

    if (
      maximumTotalStake <
      minimumExecutableTotalStake
    ) {
      return this.snapshot({
        input,

        maximumTotalStake,

        minimumExecutableTotalStake,

        status:
          'BLOCKED',

        chipsPerTarget:
          0,

        stakePerTarget:
          0,

        totalStake:
          0,

        unusedBudget:
          maximumTotalStake,

        blocker:
          'PAPER_STAKE_BUDGET_BELOW_MINIMUM_EXECUTABLE',
      });
    }

    /*
     * One complete layout costs:
     *
     * targetCount × minimumChipValue
     *
     * Therefore we only allow an integer number of complete
     * equal-value layouts.
     */
    const chipsPerTarget =
      Math.floor(
        (
          maximumTotalStake +
          1e-9
        ) /
        minimumExecutableTotalStake,
      );

    if (
      chipsPerTarget <
      1
    ) {
      throw new Error(
        'paper_stake_plan_internal_quantization_failure',
      );
    }

    const stakePerTarget =
      this.money(
        chipsPerTarget *
        chip,
      );

    const totalStake =
      this.money(
        stakePerTarget *
        input.targetCount,
      );

    /*
     * Hard institutional invariant:
     *
     * Physical quantization may NEVER increase risk.
     */
    if (
      totalStake >
      maximumTotalStake +
      1e-9
    ) {
      throw new Error(
        'paper_stake_plan_exposure_cap_violated',
      );
    }

    const unusedBudget =
      this.money(
        maximumTotalStake -
        totalStake,
      );

    return this.snapshot({
      input,

      maximumTotalStake,

      minimumExecutableTotalStake,

      status:
        'READY',

      chipsPerTarget,

      stakePerTarget,

      totalStake,

      unusedBudget,

      blocker:
        null,
    });
  }


  private snapshot(
    values: {
      readonly input:
        StrategyPaperStakePlanInput;

      readonly maximumTotalStake:
        number;

      readonly minimumExecutableTotalStake:
        number;

      readonly status:
        StrategyPaperStakePlanStatus;

      readonly chipsPerTarget:
        number;

      readonly stakePerTarget:
        number;

      readonly totalStake:
        number;

      readonly unusedBudget:
        number;

      readonly blocker:
        string | null;
    },
  ): StrategyPaperStakePlanSnapshot {
    return Object.freeze({
      strategyId:
        values.input.strategyId,

      status:
        values.status,

      provider:
        values.input.provider,

      currency:
        'BRL' as const,

      minimumChipValue:
        this.money(
          values.input.minimumChipValue,
        ),

      targetCount:
        values.input.targetCount,

      maximumTotalStake:
        values.maximumTotalStake,

      minimumExecutableTotalStake:
        values.minimumExecutableTotalStake,

      chipsPerTarget:
        values.chipsPerTarget,

      stakePerTarget:
        values.stakePerTarget,

      totalStake:
        values.totalStake,

      unusedBudget:
        values.unusedBudget,

      blocker:
        values.blocker,

      paperOnly:
        true as const,

      recommendationOnly:
        true as const,

      humanExecutionRequired:
        true as const,

      automaticExecutionAllowed:
        false as const,
    });
  }


  private validateInput(
    input:
      StrategyPaperStakePlanInput,
  ): void {
    if (
      typeof input.strategyId !==
        'string' ||
      input.strategyId
        .trim()
        .length ===
        0
    ) {
      throw new Error(
        'paper_stake_invalid_strategy_id',
      );
    }

    if (
      input.provider !==
        'PRAGMATIC' &&
      input.provider !==
        'EVOLUTION'
    ) {
      throw new Error(
        'paper_stake_invalid_provider',
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
        'paper_stake_invalid_minimum_chip',
      );
    }

    if (
      !Number.isInteger(
        input.targetCount,
      ) ||
      input.targetCount <=
        0
    ) {
      throw new Error(
        'paper_stake_invalid_target_count',
      );
    }

    if (
      !Number.isFinite(
        input.maximumTotalStake,
      ) ||
      input.maximumTotalStake <
        0
    ) {
      throw new Error(
        'paper_stake_invalid_maximum_total_stake',
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
