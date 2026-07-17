import { BenchmarkComparisonService } from '../backtesting/BenchmarkComparisonService';
import { CapitalExposureService } from '../backtesting/CapitalExposureService';
import { MonteCarloV2Service } from '../backtesting/MonteCarloV2Service';

import {
  WarmupSessionService,
  WarmupSessionServiceInput,
  WarmupSessionServiceReport
} from '../session/WarmupSessionService';

import { DatasetEngine } from '../../domain/research/DatasetEngine';

import {
  StrategyEngine,
  StrategyAnalysis
} from '../../domain/services/StrategyEngine';

import {
  BenchmarkDecisionSnapshot,
  CapitalDecisionSnapshot,
  MonteCarloDecisionSnapshot,
  StrategyDecisionContext,
  StrategyDecisionEngine,
  StrategyDecisionReport,
  StrategySignalSnapshot,
  WarmupDecisionSnapshot
} from '../../domain/decision/StrategyDecisionEngine';

import {
  StrategyRankingService,
  StrategyRankingCandidateInput
} from './StrategyRankingService';


export interface StrategyDecisionServiceInput {

  readonly source?: WarmupSessionServiceInput['source'];

  readonly dataset?: unknown;

  readonly history?: unknown;

  readonly records?: unknown;

  readonly values?: readonly number[];

  readonly visionRaw?: string | unknown;

  readonly bankroll?: number;

  readonly sessionId?: string;
}


export interface StrategyDecisionServiceReport {

  readonly service: 'StrategyDecisionService';

  readonly schemaVersion: '2.9.0';

  readonly status:
    | 'REJECTED'
    | 'WATCHLIST'
    | 'RESEARCH_CANDIDATE';

  readonly sessionId: string;

  readonly dataset: {

    readonly totalRecords: number;

    readonly checksum?: string;
  };

  readonly warmup: WarmupSessionServiceReport;

  readonly decision: StrategyDecisionReport;

  readonly diagnostics: {

    readonly strategyStatus: StrategySignalSnapshot['status'];

    readonly benchmarkVerdict: BenchmarkDecisionSnapshot['verdict'];

    readonly capitalStatus: CapitalDecisionSnapshot['reviewStatus'];

    readonly monteCarloStatus: MonteCarloDecisionSnapshot['reviewStatus'];
  };

  readonly generatedAt: string;
}


export class StrategyDecisionService {


  private readonly datasetEngine =
    new DatasetEngine();


  private readonly warmupService =
    new WarmupSessionService();


  private readonly strategyEngine =
    new StrategyEngine();


  private readonly benchmarkService =
    new BenchmarkComparisonService();


  private readonly capitalService =
    new CapitalExposureService();


  private readonly monteCarloService =
    new MonteCarloV2Service();


  private readonly decisionEngine =
    new StrategyDecisionEngine();


  private readonly rankingService =
    new StrategyRankingService();



  public evaluate(
    input: StrategyDecisionServiceInput | unknown
  ): StrategyDecisionServiceReport {


    const normalizedInput =
      this.normalizeInput(input);


    const raw =
      normalizedInput.values ??
      normalizedInput.history ??
      normalizedInput.records ??
      normalizedInput.dataset ??
      [];


    const parsed =
      this.datasetEngine.parse(
        Array.isArray(raw)
          ? [...raw]
          : String(raw ?? '')
      );


    const normalized =
      this.datasetEngine.normalize(
        parsed.records
      );


    const values =
      normalized.records.map(
        record => record.value
      );


    const sessionId =
      normalizedInput.sessionId?.trim()
      ||
      normalized.checksum
      ||
      `session-${values.length}`;



    const warmup =
      this.warmupService.evaluate({

        source:
          normalizedInput.source
          ??
          (
            normalizedInput.visionRaw
              ? 'vision'
              : 'dataset'
          ),

        dataset:
          raw,

        values:
          normalizedInput.values,

        visionRaw:
          normalizedInput.visionRaw
      });



    const strategy =
      this.safeStrategy(
        values
      );


    const benchmark =
      this.safeBenchmark(
        values
      );


    const capital =
      this.safeCapital(
        values
      );


    const monteCarlo =
      this.safeMonteCarlo(
        values
      );



    const rankingCandidate =
      this.buildRankingCandidate(
        strategy
      );


    this.rankingService.evaluate({
      strategies: [
        rankingCandidate
      ]
    });


    const context: StrategyDecisionContext = {

      sessionId,

      bankroll:
        Number(
          normalizedInput.bankroll ?? 0
        ),

      warmup:
        this.mapWarmup(
          warmup
        ),

      strategy,

      benchmark,

      capital,

      monteCarlo
    };


    const decision =
      this.decisionEngine.decide(
        context
      );


    return {

      service:
        'StrategyDecisionService',

      schemaVersion:
        '2.9.0',

      status:
        decision.decisionGrade,

      sessionId,

      dataset: {

        totalRecords:
          values.length,

        checksum:
          normalized.checksum
      },


      warmup,

      decision,


      diagnostics: {

        strategyStatus:
          strategy.status,

        benchmarkVerdict:
          benchmark.verdict,

        capitalStatus:
          capital.reviewStatus,

        monteCarloStatus:
          monteCarlo.reviewStatus
      },


      generatedAt:
        new Date().toISOString()
    };
  }



  private buildRankingCandidate(
    strategy: StrategySignalSnapshot
  ): StrategyRankingCandidateInput {


    return {

      strategyId:
        'strategy-primary',

      label:
        'Primary Strategy Candidate',

      analysis:
        undefined,

      signal:
        strategy
    };
  }



  private normalizeInput(
    input: StrategyDecisionServiceInput | unknown
  ): StrategyDecisionServiceInput {


    if (Array.isArray(input)) {

      return {

        values:
          input.filter(
            (
              item
            ): item is number =>
              typeof item === 'number'
          )
      };
    }


    if (
      input &&
      typeof input === 'object'
    ) {

      return input as StrategyDecisionServiceInput;
    }


    return {

      dataset:
        input
    };
  }



  private safeStrategy(
    values: readonly number[]
  ): StrategySignalSnapshot {


    try {

      const analysis =
        this.strategyEngine.analyze(
          [...values]
        );


      if (!analysis) {

        return {

          status:
            'INSUFFICIENT_SAMPLE',

          sampleSize:
            values.length,

          signalCount:
            0,

          maxSignalConfidence:
            0,

          suggestedFraction:
            0,

          riskLevel:
            'CRITICAL'
        };
      }


      return this.mapStrategy(
        analysis
      );


    } catch {


      return {

        status:
          'DENIED',

        sampleSize:
          values.length,

        signalCount:
          0,

        maxSignalConfidence:
          0,

        suggestedFraction:
          0,

        riskLevel:
          'CRITICAL'
      };
    }
  }



  private mapStrategy(
    analysis: StrategyAnalysis
  ): StrategySignalSnapshot {


    return {

      status:
        analysis.status,

      sampleSize:
        analysis.metrics.sampleSize,

      signalCount:
        analysis.signals.length,

      maxSignalConfidence:
        analysis.signals.length === 0
          ? 0
          :
            Math.max(
              ...analysis.signals.map(
                signal =>
                  signal.confidence
              )
            ),

      suggestedFraction:
        analysis.suggestedFraction,

      riskLevel:
        analysis.risk.level
    };
  }


  private safeBenchmark(
    values: readonly number[]
  ): BenchmarkDecisionSnapshot {

    try {

      const report =
        this.benchmarkService.evaluate(
          [...values]
        );

      return {
        verdict:
          report.status,

        benchmarkScore:
          report.executiveSummary.benchmarkScore ?? 0,

        relativeEdge:
          report.executiveSummary.relativeEdge ?? 0,

        baselineDominanceRisk:
          report.executiveSummary.baselineDominanceRisk ?? 1,

        beatRateByCandidate:
          report.benchmark?.randomBaseline?.beatRateByCandidate ?? 0
      };

    } catch {

      return {
        verdict: 'UNAVAILABLE',
        benchmarkScore: 0,
        relativeEdge: 0,
        baselineDominanceRisk: 1,
        beatRateByCandidate: 0
      };

    }
  }



  private safeCapital(
    values: readonly number[]
  ): CapitalDecisionSnapshot {

    try {

      const report =
        this.capitalService.evaluate(
          [...values]
        );

      const summary =
        report.analysis?.summary;

      return {
        reviewStatus:
          report.status,

        ruinProbability:
          summary?.advancedRiskOfRuin?.probability ?? 1,

        worstDrawdown:
          summary?.worstDrawdown ?? 1,

        exposureSaturation:
          summary?.maxExposureSaturation ?? 1,

        circuitBreakerCount:
          summary?.governance?.circuitBreakers?.length ?? 0
      };

    } catch {

      return {
        reviewStatus: 'UNAVAILABLE',
        ruinProbability: 1,
        worstDrawdown: 1,
        exposureSaturation: 1,
        circuitBreakerCount: 0
      };

    }
  }



  private safeMonteCarlo(
    values: readonly number[]
  ): MonteCarloDecisionSnapshot {

    try {

      const report =
        this.monteCarloService.evaluate(
          [...values]
        );

      return {
        reviewStatus:
          report.status,

        robustnessScore:
          report.executiveSummary.robustnessScore,

        ruinProbability:
          report.executiveSummary.ruinProbability,

        p95MaxDrawdown:
          report.simulation?.summary.p95MaxDrawdown ?? 1,

        sequenceDependencyRisk:
          report.simulation?.summary.sequenceDependencyRisk ?? 1,

        tailRisk:
          report.executiveSummary.tailRisk === 'LOW'
          || report.executiveSummary.tailRisk === 'MODERATE'
          || report.executiveSummary.tailRisk === 'HIGH'
          || report.executiveSummary.tailRisk === 'CRITICAL'
            ? report.executiveSummary.tailRisk
            : 'UNAVAILABLE'
      };

    } catch {

      return {
        reviewStatus:
          'UNAVAILABLE',

        robustnessScore:
          0,

        ruinProbability:
          1,

        p95MaxDrawdown:
          1,

        sequenceDependencyRisk:
          1,

        tailRisk:
          'UNAVAILABLE'
      };
    }
  }



  private mapWarmup(
    warmup: WarmupSessionServiceReport
  ): WarmupDecisionSnapshot {

    return {

      tableGate:
        warmup.executiveSummary.tableGate,

      riskLabel:
        warmup.warmup?.riskLabel ?? 'CRITICAL',

      completeness:
        warmup.warmup?.sample.completeness ?? 0,

      normalizedEntropy:
        warmup.warmup?.metrics.normalizedEntropy ?? 1,

      thirdLawDeviation:
        warmup.warmup?.metrics.thirdLawDeviation ?? 1,

      maxNumberConcentration:
        warmup.warmup?.metrics.maxNumberConcentration ?? 1
    };
  }


}

