import {
  StrategyRankingAdapter,
  StrategyRankingAdapterInput
} from './StrategyRankingAdapter';

import {
  StrategyRankingReport,
  StrategyRankingItem
} from '../../domain/strategy/StrategyRankingEngine';

import {
  StrategyAnalysis
} from '../../domain/services/StrategyEngine';

import {
  StrategySignalSnapshot
} from '../../domain/decision/StrategyDecisionEngine';


export interface StrategyRankingServiceInput {

  readonly strategies: readonly StrategyRankingCandidateInput[];

}


export interface StrategyRankingCandidateInput {

  readonly strategyId?: string;

  readonly label?: string;

  readonly analysis?: StrategyAnalysis;

  readonly signal?: StrategySignalSnapshot;

  readonly bankroll?: number;

  readonly historicalPerformance?: {

    readonly wins: number;

    readonly losses: number;

    readonly pushes?: number;

  };


  readonly risk?: {

    readonly maxDrawdown?: number;

    readonly volatility?: number;

  };

}


export interface StrategyRankingServiceReport {

  readonly service:
    'StrategyRankingService';


  readonly schemaVersion:
    '1.0.0';


  readonly ranking:
    StrategyRankingReport;


  readonly summary: {

    readonly candidateCount: number;

    readonly eligibleCount: number;

    readonly topStrategyId: string | null;

    readonly topScore: number;

  };


  readonly generatedAt:
    string;

}


/**
 * Application service responsible for strategy ranking orchestration.
 *
 * Responsibilities:
 *
 * - Adapt application inputs
 * - Delegate translation to StrategyRankingAdapter
 * - Execute domain StrategyRankingEngine
 *
 * No ranking rules live here.
 */
export class StrategyRankingService {


  private readonly adapter:
    StrategyRankingAdapter;



  public constructor(
    adapter: StrategyRankingAdapter = new StrategyRankingAdapter()
  ) {

    this.adapter = adapter;

  }



  public evaluate(
    input: StrategyRankingServiceInput
  ): StrategyRankingServiceReport {


    if (
      !input
      ||
      !Array.isArray(input.strategies)
    ) {

      throw new Error(
        'invalid_strategy_ranking_service_input'
      );

    }



    const ranking =
      this.adapter.rank(
        input.strategies.map(
          strategy =>
            this.mapInput(strategy)
        )
      );



    const top =
      ranking.topCandidate;



    return {

      service:
        'StrategyRankingService',


      schemaVersion:
        '1.0.0',


      ranking,


      summary: {

        candidateCount:
          ranking.candidateCount,


        eligibleCount:
          ranking.eligibleCount,


        topStrategyId:
          top
          ? top.strategyId
          : null,


        topScore:
          top
          ? top.compositeScore
          : 0

      },


      generatedAt:
        new Date().toISOString()

    };

  }



  public topCandidate(
    report: StrategyRankingServiceReport
  ): StrategyRankingItem | null {


    return report.ranking.topCandidate;

  }



  private mapInput(
    input: StrategyRankingCandidateInput
  ): StrategyRankingAdapterInput {


    return {

      strategyId:
        input.strategyId,


      label:
        input.label,


      analysis:
        input.analysis,


      signal:
        input.signal,


      bankroll:
        input.bankroll,


      historicalPerformance:
        input.historicalPerformance,


      risk:
        input.risk

    };

  }

}
