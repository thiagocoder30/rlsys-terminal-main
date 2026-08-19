import {
  TriplicacaoActionSemantics,
  type TriplicacaoActionSemanticsResult,
  type TriplicacaoActionColor,
} from './TriplicacaoActionSemantics.js';

import type {
  TriplicacaoAdvancedProbabilityAnalysis,
} from '../../domain/analytics/TriplicacaoAdvancedProbabilityEngine.js';


export type TriplicacaoFormationState =
  | 'WAITING_FIRST'
  | 'WAITING_SECOND'
  | 'WAITING_THIRD';


export type TriplicacaoSettlement =
  | 'WIN'
  | 'LOSS'
  | 'VOID'
  | null;


export interface TriplicacaoProspectiveInput {
  readonly spin:
    number;

  readonly analysis:
    TriplicacaoAdvancedProbabilityAnalysis;
}


export interface TriplicacaoProspectiveResult {
  readonly stateBefore:
    TriplicacaoFormationState;

  readonly stateAfter:
    TriplicacaoFormationState;

  readonly spin:
    number;

  readonly firstNumber:
    number | null;

  readonly secondNumber:
    number | null;

  readonly action:
    TriplicacaoActionSemanticsResult | null;

  readonly settlement:
    TriplicacaoSettlement;

  readonly settledTargetColor:
    TriplicacaoActionColor | null;

  readonly settledSpinColor:
    TriplicacaoActionColor | 'ZERO' | null;

  readonly trioCompleted:
    boolean;

  readonly trioDiscarded:
    boolean;

  readonly reasons:
    readonly string[];

  readonly paperOnly: true;

  readonly liveMoneyAuthorization: false;

  readonly automaticBetExecutionAllowed: false;

  readonly operatorDecisionRequired: true;
}


/**
 * Owns the prospective LIVE formation lifecycle for Triplicação.
 *
 * Canonical fixed trio lifecycle:
 *
 * WAITING_FIRST
 *      ↓
 * position 1
 *      ↓
 * WAITING_SECOND
 *      ↓
 * position 2
 *      ↓
 * WAITING_THIRD
 *      ↓
 * position 3
 *      ↓
 * classify / settle / discard
 *      ↓
 * WAITING_FIRST
 *
 * ZERO INTEGRITY RULE
 * -------------------
 *
 * The temporal trio boundary is NEVER shifted by zero.
 *
 * Examples:
 *
 *   0, 17, 24 | 8, 11, 30
 *   ---------   ----------
 *      VOID      next trio
 *
 *   17, 0, 24 | 8, 11, 30
 *   ---------   ----------
 *      VOID      next trio
 *
 *   17, 24, 0 | 8, 11, 30
 *   ---------   ----------
 *      VOID      next trio
 *
 * If zero appears before the third position, the remaining positions
 * still belong to the invalidated trio and are consumed normally.
 *
 * During an invalidated trio:
 *
 * - no action is resolved;
 * - no recommendation is issued;
 * - no counterfactual decision point may exist;
 * - the trio becomes officially discarded only after position 3;
 * - the following spin starts the next trio.
 *
 * This coordinator never executes a bet.
 */
export class TriplicacaoProspectiveFormationCoordinator {
  private state:
    TriplicacaoFormationState =
      'WAITING_FIRST';

  private firstNumber:
    number | null =
      null;

  private secondNumber:
    number | null =
      null;

  private currentAction:
    TriplicacaoActionSemanticsResult | null =
      null;

  private zeroInvalidated =
    false;

  private zeroPosition:
    1 | 2 | 3 | null =
      null;


  public constructor(
    private readonly actionSemantics:
      TriplicacaoActionSemantics =
        new TriplicacaoActionSemantics(),
  ) {}


  public ingest(
    input:
      TriplicacaoProspectiveInput,
  ): TriplicacaoProspectiveResult {
    this.validateSpin(
      input.spin,
    );

    const stateBefore =
      this.state;


    /*
     * POSITION 1
     */
    if (
      this.state ===
      'WAITING_FIRST'
    ) {
      this.firstNumber =
        input.spin;

      this.secondNumber =
        null;

      this.currentAction =
        null;

      this.zeroInvalidated =
        input.spin ===
        0;

      this.zeroPosition =
        input.spin ===
        0
          ? 1
          : null;

      this.state =
        'WAITING_SECOND';

      return this.result({
        stateBefore,

        stateAfter:
          this.state,

        spin:
          input.spin,

        action:
          null,

        settlement:
          null,

        settledTargetColor:
          null,

        settledSpinColor:
          null,

        trioCompleted:
          false,

        trioDiscarded:
          false,

        reasons:
          input.spin ===
            0
            ? [
                'TRIPLICACAO_ZERO_AT_FIRST_POSITION',
                'TRIPLICACAO_TRIO_INVALIDATED_AWAITING_REMAINING_POSITIONS',
              ]
            : [
                'TRIPLICACAO_FIRST_POSITION_RECEIVED',
              ],
      });
    }


    /*
     * POSITION 2
     */
    if (
      this.state ===
      'WAITING_SECOND'
    ) {
      if (
        this.firstNumber ===
        null
      ) {
        throw new Error(
          'triplicacao_formation_corrupted_first_position',
        );
      }

      this.secondNumber =
        input.spin;

      if (
        input.spin ===
        0 &&
        !this.zeroInvalidated
      ) {
        this.zeroInvalidated =
          true;

        this.zeroPosition =
          2;
      }

      /*
       * Once zero has invalidated this fixed trio, no action semantics
       * are allowed for position 2. We still advance to WAITING_THIRD
       * because position 3 belongs to this same trio.
       */
      if (
        this.zeroInvalidated
      ) {
        this.currentAction =
          null;

        this.state =
          'WAITING_THIRD';

        return this.result({
          stateBefore,

          stateAfter:
            this.state,

          spin:
            input.spin,

          action:
            null,

          settlement:
            null,

          settledTargetColor:
            null,

          settledSpinColor:
            null,

          trioCompleted:
            false,

          trioDiscarded:
            false,

          reasons: [
            ...(input.spin ===
              0
              ? [
                  'TRIPLICACAO_ZERO_AT_SECOND_POSITION',
                ]
              : []),

            'TRIPLICACAO_TRIO_INVALIDATED_AWAITING_THIRD_POSITION',
          ],
        });
      }

      this.currentAction =
        this.actionSemantics.resolve({
          analysis:
            input.analysis,

          firstNumber:
            this.firstNumber,

          secondNumber:
            this.secondNumber,
        });

      this.state =
        'WAITING_THIRD';

      return this.result({
        stateBefore,

        stateAfter:
          this.state,

        spin:
          input.spin,

        action:
          this.currentAction,

        settlement:
          null,

        settledTargetColor:
          null,

        settledSpinColor:
          null,

        trioCompleted:
          false,

        trioDiscarded:
          false,

        reasons: [
          'TRIPLICACAO_SECOND_POSITION_RECEIVED',
          `TRIPLICACAO_ACTION_STATUS:${this.currentAction.status}`,
        ],
      });
    }


    /*
     * POSITION 3
     */
    if (
      this.firstNumber ===
        null ||
      this.secondNumber ===
        null
    ) {
      throw new Error(
        'triplicacao_formation_corrupted_third_position',
      );
    }

    if (
      input.spin ===
      0 &&
      !this.zeroInvalidated
    ) {
      this.zeroInvalidated =
        true;

      this.zeroPosition =
        3;
    }

    if (
      this.zeroInvalidated
    ) {
      return this.completeDiscardedTrio({
        stateBefore,
        spin:
          input.spin,
      });
    }

    const action =
      this.currentAction;

    const spinColor =
      this.toColor(
        input.spin,
      );

    const settlement =
      this.settle(
        action,
        spinColor,
      );

    const targetColor =
      action?.status ===
        'ACTION'
        ? action.targetColor
        : null;

    const result =
      this.result({
        stateBefore,

        stateAfter:
          'WAITING_FIRST',

        spin:
          input.spin,

        action,

        settlement,

        settledTargetColor:
          targetColor,

        settledSpinColor:
          spinColor,

        trioCompleted:
          true,

        trioDiscarded:
          false,

        reasons: [
          'TRIPLICACAO_THIRD_POSITION_RECEIVED',
          `TRIPLICACAO_SETTLEMENT:${settlement ?? 'NO_ACTION'}`,
        ],
      });

    this.reset();

    return result;
  }


  public snapshot(): {
    readonly state:
      TriplicacaoFormationState;

    readonly firstNumber:
      number | null;

    readonly secondNumber:
      number | null;

    readonly currentAction:
      TriplicacaoActionSemanticsResult | null;

    readonly zeroInvalidated:
      boolean;

    readonly zeroPosition:
      1 | 2 | 3 | null;
  } {
    return Object.freeze({
      state:
        this.state,

      firstNumber:
        this.firstNumber,

      secondNumber:
        this.secondNumber,

      currentAction:
        this.currentAction,

      zeroInvalidated:
        this.zeroInvalidated,

      zeroPosition:
        this.zeroPosition,
    });
  }


  private settle(
    action:
      TriplicacaoActionSemanticsResult | null,

    spinColor:
      TriplicacaoActionColor,
  ): TriplicacaoSettlement {
    if (
      action ===
        null ||
      action.status !==
        'ACTION' ||
      action.targetColor ===
        null
    ) {
      return null;
    }

    return action.targetColor ===
      spinColor
      ? 'WIN'
      : 'LOSS';
  }


  private completeDiscardedTrio(
    input: {
      readonly stateBefore:
        TriplicacaoFormationState;

      readonly spin:
        number;
    },
  ): TriplicacaoProspectiveResult {
    const zeroPosition =
      this.zeroPosition;

    if (
      zeroPosition ===
      null
    ) {
      throw new Error(
        'triplicacao_formation_zero_position_missing',
      );
    }

    const result =
      this.result({
        stateBefore:
          input.stateBefore,

        stateAfter:
          'WAITING_FIRST',

        spin:
          input.spin,

        action:
          null,

        settlement:
          'VOID',

        settledTargetColor:
          null,

        settledSpinColor:
          input.spin ===
            0
            ? 'ZERO'
            : this.toColor(
                input.spin,
              ),

        trioCompleted:
          false,

        trioDiscarded:
          true,

        reasons: [
          `TRIPLICACAO_ZERO_POSITION:${zeroPosition}`,
          'TRIPLICACAO_FIXED_TRIO_CONSUMED',
          'TRIPLICACAO_TRIO_DISCARDED_BY_ZERO',
        ],
      });

    this.reset();

    return result;
  }


  private result(
    input: {
      readonly stateBefore:
        TriplicacaoFormationState;

      readonly stateAfter:
        TriplicacaoFormationState;

      readonly spin:
        number;

      readonly action:
        TriplicacaoActionSemanticsResult | null;

      readonly settlement:
        TriplicacaoSettlement;

      readonly settledTargetColor:
        TriplicacaoActionColor | null;

      readonly settledSpinColor:
        TriplicacaoActionColor | 'ZERO' | null;

      readonly trioCompleted:
        boolean;

      readonly trioDiscarded:
        boolean;

      readonly reasons:
        readonly string[];
    },
  ): TriplicacaoProspectiveResult {
    return Object.freeze({
      stateBefore:
        input.stateBefore,

      stateAfter:
        input.stateAfter,

      spin:
        input.spin,

      firstNumber:
        this.firstNumber,

      secondNumber:
        this.secondNumber,

      action:
        input.action,

      settlement:
        input.settlement,

      settledTargetColor:
        input.settledTargetColor,

      settledSpinColor:
        input.settledSpinColor,

      trioCompleted:
        input.trioCompleted,

      trioDiscarded:
        input.trioDiscarded,

      reasons:
        Object.freeze([
          ...input.reasons,
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


  private reset(): void {
    this.state =
      'WAITING_FIRST';

    this.firstNumber =
      null;

    this.secondNumber =
      null;

    this.currentAction =
      null;

    this.zeroInvalidated =
      false;

    this.zeroPosition =
      null;
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
        'triplicacao_formation_invalid_spin',
      );
    }
  }


  private toColor(
    spin:
      number,
  ): TriplicacaoActionColor {
    const redNumbers =
      new Set([
        1, 3, 5, 7, 9,
        12, 14, 16, 18,
        19, 21, 23, 25,
        27, 30, 32, 34,
        36,
      ]);

    return redNumbers.has(
      spin,
    )
      ? 'RED'
      : 'BLACK';
  }
}
