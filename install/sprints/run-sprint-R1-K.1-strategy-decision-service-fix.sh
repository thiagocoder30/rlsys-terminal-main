#!/data/data/com.termux/files/usr/bin/bash

set -e

FILE="src/application/decision/StrategyDecisionService.ts"

echo "=================================================="
echo "RL.SYS CORE"
echo "PATCH SPRINT - StrategyDecisionService FIX"
echo "=================================================="

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

  private readonly datasetEngine = new DatasetEngine();
  private readonly warmupService = new WarmupSessionService();
  private readonly strategyEngine = new StrategyEngine();
  private readonly benchmarkService = new BenchmarkComparisonService();
  private readonly capitalService = new CapitalExposureService();
  private readonly monteCarloService = new MonteCarloV2Service();
  private readonly decisionEngine = new StrategyDecisionEngine();
  private readonly rankingService = new StrategyRankingService();


  public evaluate(
    input: StrategyDecisionServiceInput | unknown
  ): StrategyDecisionServiceReport {

    const normalizedInput = this.normalizeInput(input);

    const raw =
      normalizedInput.values ??
      normalizedInput.history ??
      normalizedInput.records ??
      normalizedInput.dataset ??
      [];

    const parsed =
      this.datasetEngine.parse(
        Array.isArray(raw) ? [...raw] : String(raw ?? '')
      );

    const normalized =
      this.datasetEngine.normalize(parsed.records);

    const values =
      normalized.records.map(record => record.value);

    const sessionId =
      normalizedInput.sessionId?.trim()
      || normalized.checksum
      || `session-${values.length}`;


    const warmup =
      this.warmupService.evaluate({
        source:
          normalizedInput.source ??
          (normalizedInput.visionRaw ? 'vision' : 'dataset'),
        dataset: raw,
        values: normalizedInput.values,
        visionRaw: normalizedInput.visionRaw
      });


    const strategy = this.safeStrategy(values);
    const benchmark = this.safeBenchmark(values);
    const capital = this.safeCapital(values);
    const monteCarlo = this.safeMonteCarlo(values);


    this.rankingService.rank([
      this.buildRankingCandidate(strategy)
    ]);


    const context: StrategyDecisionContext = {
      sessionId,
      bankroll: Number(normalizedInput.bankroll ?? 0),
      warmup: this.mapWarmup(warmup),
      strategy,
      benchmark,
      capital,
      monteCarlo
    };


    const decision =
      this.decisionEngine.decide(context);


    return {
      service: 'StrategyDecisionService',
      schemaVersion: '2.9.0',
      status: decision.decisionGrade,
      sessionId,
      dataset: {
        totalRecords: values.length,
        checksum: normalized.checksum
      },
      warmup,
      decision,
      diagnostics: {
        strategyStatus: strategy.status,
        benchmarkVerdict: benchmark.verdict,
        capitalStatus: capital.reviewStatus,
        monteCarloStatus: monteCarlo.reviewStatus
      },
      generatedAt: new Date().toISOString()
    };
  }


  private buildRankingCandidate(
    strategy: StrategySignalSnapshot
  ): StrategyRankingCandidateInput {

    const analysis: StrategyAnalysis | undefined =
      this.strategyEngine.getLastAnalysis?.()
      ?? undefined;

    return {
      strategyId: 'strategy-primary',
      label: 'Primary Strategy Candidate',
      analysis,
      signal: strategy
    };
  }


  private normalizeInput(
    input: StrategyDecisionServiceInput | unknown
  ): StrategyDecisionServiceInput {

    if (Array.isArray(input)) {
      return {
        values:
          input.filter(
            (item): item is number =>
              typeof item === 'number'
          )
      };
    }

    if (input && typeof input === 'object') {
      return input as StrategyDecisionServiceInput;
    }

    return {
      dataset: input
    };
  }


  private safeStrategy(
    values: readonly number[]
  ): StrategySignalSnapshot {

    try {

      const analysis =
        this.strategyEngine.analyze([...values]);

      if (!analysis) {
        return {
          status: 'INSUFFICIENT_SAMPLE',
          sampleSize: values.length,
          signalCount: 0,
          maxSignalConfidence: 0,
          suggestedFraction: 0,
          riskLevel: 'CRITICAL'
        };
      }

      return this.mapStrategy(analysis);

    } catch {

      return {
        status: 'DENIED',
        sampleSize: values.length,
        signalCount: 0,
        maxSignalConfidence: 0,
        suggestedFraction: 0,
        riskLevel: 'CRITICAL'
      };

    }
  }


  private mapStrategy(
    analysis: StrategyAnalysis
  ): StrategySignalSnapshot {

    return {
      status: analysis.status,
      sampleSize: analysis.metrics.sampleSize,
      signalCount: analysis.signals.length,
      maxSignalConfidence:
        analysis.signals.length === 0
          ? 0
          : Math.max(
              ...analysis.signals.map(
                signal => signal.confidence
              )
            ),
      suggestedFraction:
        analysis.suggestedFraction,
      riskLevel:
        analysis.risk.level
    };
  }
EOF

echo "Arquivo atualizado parcialmente: $FILE"
echo "Sprint patch criado."
