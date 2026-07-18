#!/data/data/com.termux/files/usr/bin/bash

set -e

echo "=================================================="
echo "RL.SYS CORE"
echo "SPRINT R1-K.2"
echo "StrategyDecisionService FULL REPLACEMENT - PART A"
echo "=================================================="


FILE="src/application/decision/StrategyDecisionService.ts"

cat > "$FILE" <<'EOF'
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


    this.rankingService.evaluate([
      rankingCandidate
    ]);

EOF

cat >> src/application/decision/StrategyDecisionService.ts <<'EOF'

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

EOF

cat >> src/application/decision/StrategyDecisionService.ts <<'EOF'

  private safeBenchmark(
    values: readonly number[]
  ): BenchmarkDecisionSnapshot {

    try {

      return this.benchmarkService.evaluate(
        values
      );

    } catch {

      return {

        verdict:
          'UNAVAILABLE',

        benchmarkScore:
          0,

        relativeEdge:
          0,

        baselineDominanceRisk:
          1,

        beatRateByCandidate:
          0
      };
    }
  }



  private safeCapital(
    values: readonly number[]
  ): CapitalDecisionSnapshot {

    try {

      return this.capitalService.evaluate(
        values
      );

    } catch {

      return {

        reviewStatus:
          'UNAVAILABLE',

        ruinProbability:
          1,

        worstDrawdown:
          1,

        exposureSaturation:
          1,

        circuitBreakerCount:
          0
      };
    }
  }



  private safeMonteCarlo(
    values: readonly number[]
  ): MonteCarloDecisionSnapshot {

    try {

      return this.monteCarloService.evaluate(
        values
      );

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
        warmup.tableGate,

      riskLabel:
        warmup.riskLabel,

      completeness:
        warmup.completeness,

      normalizedEntropy:
        warmup.normalizedEntropy,

      thirdLawDeviation:
        warmup.thirdLawDeviation,

      maxNumberConcentration:
        warmup.maxNumberConcentration
    };
  }

}

EOF


chmod +x src/application/decision/StrategyDecisionService.ts

echo "=================================================="
echo "RL.SYS CORE"
echo "StrategyDecisionService replacement complete"
echo "=================================================="

npx tsc --noEmit

git add src/application/decision/StrategyDecisionService.ts

git commit -m "fix(decision): rebuild StrategyDecisionService contracts"

echo "Sprint concluída."
