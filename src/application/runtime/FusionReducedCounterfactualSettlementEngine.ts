import type {
  FusionReducedProspectiveDecision,
} from './FusionReducedProspectiveDecisionSemantics.js';


export type FusionReducedCounterfactualOutcome =
  | 'WIN'
  | 'LOSS';


export interface FusionReducedCounterfactualDecisionPoint {
  readonly strategyId:
    'fusion-reduced';

  readonly targetNumbers:
    readonly number[];

  readonly createdAtDecisionIndex:
    number;

  readonly paperOnly:
    true;
}


export interface FusionReducedCounterfactualSettlement {
  readonly strategyId:
    'fusion-reduced';

  readonly outcome:
    FusionReducedCounterfactualOutcome;

  readonly spin:
    number;

  readonly targetNumbers:
    readonly number[];

  readonly paperOnly:
    true;
}


export interface FusionReducedCounterfactualSnapshot {
  readonly strategyId:
    'fusion-reduced';

  readonly pending:
    FusionReducedCounterfactualDecisionPoint | null;

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
  return Object.freeze([
    ...values,
  ]);
}


export class FusionReducedCounterfactualSettlementEngine {

  private pending:
    FusionReducedCounterfactualDecisionPoint | null =
      null;


  private settlements:
    FusionReducedCounterfactualSettlement[] =
      [];


  public registerDecision(
    decision:
      FusionReducedProspectiveDecision,
  ):
    FusionReducedCounterfactualDecisionPoint | null {

    if (
      decision.status !==
      'PAPER_READY'
    ) {
      return null;
    }


    if (
      decision.hypothesis === null
    ) {
      return null;
    }


    this.pending =
      Object.freeze({
        strategyId:
          'fusion-reduced' as const,

        targetNumbers:
          normalizeTargets(
            decision
              .hypothesis
              .targetNumbers,
          ),

        createdAtDecisionIndex:
          this.settlements.length,

        paperOnly:
          true as const,
      });


    return this.pending;
  }


  public settleNextSpin(
    spin:
      number,
  ):
    FusionReducedCounterfactualSettlement | null {

    if (
      this.pending === null
    ) {
      return null;
    }


    const decision =
      this.pending;


    this.pending =
      null;


    const outcome =
      decision
        .targetNumbers
        .includes(
          spin,
        )
        ? 'WIN'
        : 'LOSS';


    const settlement =
      Object.freeze({
        strategyId:
          'fusion-reduced' as const,

        outcome,

        spin,

        targetNumbers:
          decision
            .targetNumbers,

        paperOnly:
          true as const,
      });


    this.settlements.push(
      settlement,
    );


    return settlement;
  }


  public snapshot():
    FusionReducedCounterfactualSnapshot {

    const wins =
      this.settlements
        .filter(
          item =>
            item.outcome ===
            'WIN',
        )
        .length;


    const losses =
      this.settlements
        .filter(
          item =>
            item.outcome ===
            'LOSS',
        )
        .length;


    return Object.freeze({
      strategyId:
        'fusion-reduced' as const,

      pending:
        this.pending,

      settledCount:
        this.settlements.length,

      winCount:
        wins,

      lossCount:
        losses,

      hitRate:
        this.settlements.length === 0
          ? null
          :
          wins /
          this.settlements.length,

      averageTargetSize:
        this.settlements.length === 0
          ? 0
          :
          this.settlements
            .reduce(
              (
                total,
                item,
              ) =>
                total +
                item.targetNumbers.length,
              0,
            ) /
            this.settlements.length,

      paperOnly:
        true as const,

      bankrollChanged:
        false as const,

      automaticExecution:
        false as const,
    });
  }


  public history():
    readonly FusionReducedCounterfactualSettlement[] {
    return Object.freeze([
      ...this.settlements,
    ]);
  }


  public pendingDecision():
    FusionReducedCounterfactualDecisionPoint | null {
    return this.pending;
  }
}
