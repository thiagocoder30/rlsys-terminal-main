import {
  StrategyRankingCandidate,
  StrategyRankingEngine,
  StrategyRankingItem,
  StrategyRankingReport
} from '../../domain/strategy/StrategyRankingEngine';

import {
  StrategySignalSnapshot
} from '../../domain/decision/StrategyDecisionEngine';

import {
  StrategyAnalysis
} from '../../domain/services/StrategyEngine';


export interface StrategyRankingAdapterInput {
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


export interface StrategyRankingAdapterResult {
  readonly candidate: StrategyRankingCandidate;
  readonly ranking?: StrategyRankingReport;
}


export class StrategyRankingAdapter {

  private readonly engine: StrategyRankingEngine;


  public constructor(
    engine: StrategyRankingEngine = new StrategyRankingEngine()
  ) {
    this.engine = engine;
  }


  /**
   * Converts StrategyEngine / DecisionEngine outputs into
   * StrategyRankingEngine compatible candidates.
   *
   * This adapter keeps application boundaries isolated:
   *
   * StrategyEngine
   *        |
   *        v
   * StrategyRankingAdapter
   *        |
   *        v
   * StrategyRankingEngine
   *
   * No business rule belongs here.
   * This layer only translates contracts.
   */
  public buildCandidate(
    input: StrategyRankingAdapterInput
  ): StrategyRankingCandidate {

    const signalConfidence =
      this.resolveSignalConfidence(input);

    const sampleSize =
      this.resolveSampleSize(input);

    const outcomes =
      this.resolveOutcomes(input);


    return {
      strategyId:
        input.strategyId?.trim()
        || 'strategy-default',

      label:
        input.label?.trim()
        || 'Strategy Candidate',

      status:
        this.resolveStatus(input),

      sampleSize,

      wins:
        outcomes.wins,

      losses:
        outcomes.losses,

      pushes:
        outcomes.pushes,

      signalConfidence,

      expectedValue:
        this.resolveExpectedValue(
          input,
          outcomes
        ),

      maxDrawdown:
        this.resolveMaxDrawdown(input),

      volatility:
        this.resolveVolatility(input),

      recencyWeight:
        this.resolveRecencyWeight(
          input
        ),

      riskLevel:
        this.resolveRiskLevel(
          input
        )
    };
  }


  /**
   * Executes full ranking pipeline.
   */
  public rank(
    inputs: readonly StrategyRankingAdapterInput[]
  ): StrategyRankingReport {

    const candidates =
      inputs.map(input =>
        this.buildCandidate(input)
      );


    return this.engine.rank(
      candidates
    );
  }


  private resolveSignalConfidence(
    input: StrategyRankingAdapterInput
  ): number {

    if (input.signal) {
      return clamp(
        input.signal.maxSignalConfidence
      );
    }


    if (input.analysis) {

      if (
        input.analysis.signals.length === 0
      ) {
        return 0;
      }


      return clamp(
        Math.max(
          ...input.analysis.signals.map(
            signal =>
              signal.confidence
          )
        )
      );
    }


    return 0;
  }


  private resolveSampleSize(
    input: StrategyRankingAdapterInput
  ): number {

    if (input.signal) {
      return Math.max(
        0,
        input.signal.sampleSize
      );
    }


    if (input.analysis) {
      return Math.max(
        0,
        input.analysis.metrics.sampleSize
      );
    }


    const history =
      input.historicalPerformance;


    if (!history) {
      return 0;
    }


    return Math.max(
      0,
      history.wins
      + history.losses
      + (history.pushes ?? 0)
    );
  }

    private resolveOutcomes(
    input: StrategyRankingAdapterInput
  ): {
    readonly wins: number;
    readonly losses: number;
    readonly pushes: number;
  } {

    if (!input.historicalPerformance) {
      return {
        wins: 0,
        losses: 0,
        pushes: 0
      };
    }


    return {
      wins: Math.max(
        0,
        input.historicalPerformance.wins
      ),

      losses: Math.max(
        0,
        input.historicalPerformance.losses
      ),

      pushes: Math.max(
        0,
        input.historicalPerformance.pushes ?? 0
      )
    };
  }


  private resolveExpectedValue(
    input: StrategyRankingAdapterInput,
    outcomes: {
      readonly wins: number;
      readonly losses: number;
      readonly pushes: number;
    }
  ): number {

    const total =
      outcomes.wins
      + outcomes.losses
      + outcomes.pushes;


    if (total <= 0) {

      if (input.analysis) {

        const confidence =
          this.resolveSignalConfidence(
            input
          );

        return clamp(
          confidence - 0.5
        );
      }


      return 0;
    }


    const hitRate =
      outcomes.wins / total;


    /**
     * Proxy conservador de EV.
     *
     * Não assume lucro real.
     * Apenas transforma evidência histórica
     * em uma escala compatível com ranking.
     */
    return round(
      hitRate - 0.5
    );
  }


  private resolveMaxDrawdown(
    input: StrategyRankingAdapterInput
  ): number {

    return clamp(
      input.risk?.maxDrawdown ?? 0
    );
  }


  private resolveVolatility(
    input: StrategyRankingAdapterInput
  ): number {

    return clamp(
      input.risk?.volatility ?? 0
    );
  }


  private resolveRecencyWeight(
    input: StrategyRankingAdapterInput
  ): number {

    if (!input.signal) {
      return 0.5;
    }


    if (
      input.signal.status === 'ALLOWED'
    ) {
      return 1;
    }


    if (
      input.signal.status === 'LOCKED'
      ||
      input.signal.status === 'DENIED'
    ) {
      return 0.1;
    }


    return 0.25;
  }


  private resolveRiskLevel(
    input: StrategyRankingAdapterInput
  ): StrategyRankingCandidate['riskLevel'] {

    if (input.analysis) {

      return input.analysis.risk.level;
    }


    if (
      input.risk?.maxDrawdown !== undefined
      &&
      input.risk.maxDrawdown > 0.35
    ) {
      return 'HIGH';
    }


    if (
      input.risk?.volatility !== undefined
      &&
      input.risk.volatility > 0.42
    ) {
      return 'HIGH';
    }


    return 'MEDIUM';
  }


  private resolveStatus(
    input: StrategyRankingAdapterInput
  ): StrategyRankingCandidate['status'] {

    if (input.signal) {

      switch (input.signal.status) {

        case 'ALLOWED':
          return 'ACTIVE';

        case 'LOCKED':
        case 'DENIED':
          return 'LOCKED';

        default:
          return 'WATCHLIST';
      }
    }


    if (input.analysis) {

      if (
        input.analysis.status === 'ALLOWED'
      ) {
        return 'ACTIVE';
      }


      return 'WATCHLIST';
    }


    return 'LOCKED';
  }


  /**
   * Helper usado para converter ranking em snapshot
   * compatível com a camada de decisão.
   *
   * Mantém StrategyRankingEngine isolado.
   */
  public toDecisionSnapshot(
    ranking: StrategyRankingReport
  ): {
    readonly candidateCount: number;
    readonly eligibleCount: number;
    readonly topCandidate: StrategyRankingItem | null;
  } {

    return {
      candidateCount:
        ranking.candidateCount,

      eligibleCount:
        ranking.eligibleCount,

      topCandidate:
        ranking.topCandidate
    };
  }

    private clampConfidence(
    value: number
  ): number {

    if (!Number.isFinite(value)) {
      return 0;
    }

    return Math.max(
      0,
      Math.min(
        1,
        value
      )
    );
  }
}


function clamp(
  value: number
): number {

  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(
    0,
    Math.min(
      1,
      value
    )
  );
}


function round(
  value: number
): number {

  return Number(
    value.toFixed(6)
  );
}

