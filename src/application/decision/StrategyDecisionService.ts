import { BenchmarkComparisonService } from '../backtesting/BenchmarkComparisonService';
import { CapitalExposureService } from '../backtesting/CapitalExposureService';
import { MonteCarloV2Service } from '../backtesting/MonteCarloV2Service';
import { WarmupSessionService, WarmupSessionServiceInput, WarmupSessionServiceReport } from '../session/WarmupSessionService';
import { DatasetEngine } from '../../domain/research/DatasetEngine';
import { StrategyEngine, StrategyAnalysis } from '../../domain/services/StrategyEngine';
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
  readonly schemaVersion: '2.8.0';
  readonly status: 'REJECTED' | 'WATCHLIST' | 'RESEARCH_CANDIDATE';
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

/**
 * Application boundary for the operational decision layer.
 *
 * It adapts user/session input into canonical snapshots and delegates the actual decision
 * to the domain-only StrategyDecisionEngine. Heavy simulations are executed only when
 * enough data exists, keeping the flow deterministic and safe for mobile hardware.
 */
export class StrategyDecisionService {
  private readonly datasetEngine = new DatasetEngine();
  private readonly warmupService = new WarmupSessionService();
  private readonly strategyEngine = new StrategyEngine();
  private readonly benchmarkService = new BenchmarkComparisonService();
  private readonly capitalService = new CapitalExposureService();
  private readonly monteCarloService = new MonteCarloV2Service();
  private readonly decisionEngine = new StrategyDecisionEngine();

  public evaluate(input: StrategyDecisionServiceInput | unknown): StrategyDecisionServiceReport {
    const normalizedInput = this.normalizeInput(input);
    const raw = normalizedInput.values ?? normalizedInput.history ?? normalizedInput.records ?? normalizedInput.dataset ?? [];
    const parsed = this.datasetEngine.parse(Array.isArray(raw) ? [...raw] : String(raw ?? ''));
    const normalized = this.datasetEngine.normalize(parsed.records);
    const values = normalized.records.map(record => record.value);
    const sessionId = normalizedInput.sessionId?.trim() || normalized.checksum || `session-${values.length}`;
    const warmup = this.warmupService.evaluate({
      source: normalizedInput.source ?? (normalizedInput.visionRaw ? 'vision' : 'dataset'),
      dataset: raw,
      values: normalizedInput.values,
      visionRaw: normalizedInput.visionRaw
    });
    const strategy = this.safeStrategy(values);
    const benchmark = this.safeBenchmark(values);
    const capital = this.safeCapital(values);
    const monteCarlo = this.safeMonteCarlo(values);

    const context: StrategyDecisionContext = {
      sessionId,
      bankroll: Number(normalizedInput.bankroll ?? 0),
      warmup: this.mapWarmup(warmup),
      strategy,
      benchmark,
      capital,
      monteCarlo
    };
    const decision = this.decisionEngine.decide(context);

    return {
      service: 'StrategyDecisionService',
      schemaVersion: '2.8.0',
      status: decision.decisionGrade,
      sessionId,
      dataset: { totalRecords: values.length, checksum: normalized.checksum },
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

  private normalizeInput(input: StrategyDecisionServiceInput | unknown): StrategyDecisionServiceInput {
    if (Array.isArray(input)) return { values: input.filter((item): item is number => typeof item === 'number') };
    if (input && typeof input === 'object') return input as StrategyDecisionServiceInput;
    return { dataset: input };
  }

  private safeStrategy(values: readonly number[]): StrategySignalSnapshot {
    try {
      const analysis = this.strategyEngine.analyze([...values]);
      if (!analysis) {
        return { status: 'INSUFFICIENT_SAMPLE', sampleSize: values.length, signalCount: 0, maxSignalConfidence: 0, suggestedFraction: 0, riskLevel: 'CRITICAL' };
      }
      return this.mapStrategy(analysis);
    } catch (_error: unknown) {
      return { status: 'DENIED', sampleSize: values.length, signalCount: 0, maxSignalConfidence: 0, suggestedFraction: 0, riskLevel: 'CRITICAL' };
    }
  }

  private mapStrategy(analysis: StrategyAnalysis): StrategySignalSnapshot {
    return {
      status: analysis.status,
      sampleSize: analysis.metrics.sampleSize,
      signalCount: analysis.signals.length,
      maxSignalConfidence: analysis.signals.length === 0 ? 0 : Math.max(...analysis.signals.map(signal => signal.confidence)),
      suggestedFraction: analysis.suggestedFraction,
      riskLevel: analysis.risk.level
    };
  }

  private safeBenchmark(values: readonly number[]): BenchmarkDecisionSnapshot {
    try {
      const report = this.benchmarkService.evaluate([...values]);
      return {
        verdict: report.benchmark?.governance.verdict ?? 'UNAVAILABLE',
        benchmarkScore: report.benchmark?.comparison.benchmarkScore ?? 0,
        relativeEdge: report.benchmark?.comparison.relativeEdge ?? 0,
        baselineDominanceRisk: report.benchmark?.comparison.baselineDominanceRisk ?? 1,
        beatRateByCandidate: report.benchmark?.randomBaseline.beatRateByCandidate ?? 0
      };
    } catch (_error: unknown) {
      return { verdict: 'UNAVAILABLE', benchmarkScore: 0, relativeEdge: 0, baselineDominanceRisk: 1, beatRateByCandidate: 0 };
    }
  }

  private safeCapital(values: readonly number[]): CapitalDecisionSnapshot {
    try {
      const report = this.capitalService.evaluate([...values]);
      return {
        reviewStatus: report.analysis?.summary.governance.reviewStatus ?? 'UNAVAILABLE',
        ruinProbability: report.analysis?.summary.worstRuinProbability ?? 1,
        worstDrawdown: report.analysis?.summary.worstDrawdown ?? 1,
        exposureSaturation: report.analysis?.summary.maxExposureSaturation ?? 1,
        circuitBreakerCount: report.analysis?.summary.governance.circuitBreakers.length ?? 0
      };
    } catch (_error: unknown) {
      return { reviewStatus: 'UNAVAILABLE', ruinProbability: 1, worstDrawdown: 1, exposureSaturation: 1, circuitBreakerCount: 0 };
    }
  }

  private safeMonteCarlo(values: readonly number[]): MonteCarloDecisionSnapshot {
    try {
      const report = this.monteCarloService.evaluate([...values]);
      return {
        reviewStatus: report.simulation?.governance.reviewStatus ?? 'UNAVAILABLE',
        robustnessScore: report.simulation?.summary.robustnessScore ?? 0,
        ruinProbability: report.simulation?.summary.ruinProbability ?? 1,
        p95MaxDrawdown: report.simulation?.summary.p95MaxDrawdown ?? 1,
        sequenceDependencyRisk: report.simulation?.summary.sequenceDependencyRisk ?? 1,
        tailRisk: report.simulation?.summary.tailRisk ?? 'UNAVAILABLE'
      };
    } catch (_error: unknown) {
      return { reviewStatus: 'UNAVAILABLE', robustnessScore: 0, ruinProbability: 1, p95MaxDrawdown: 1, sequenceDependencyRisk: 1, tailRisk: 'UNAVAILABLE' };
    }
  }

  private mapWarmup(report: WarmupSessionServiceReport): WarmupDecisionSnapshot {
    const warmup = report.warmup;
    if (!warmup) {
      return {
        tableGate: 'NO_GO',
        riskLabel: 'CRITICAL',
        completeness: 0,
        normalizedEntropy: 0,
        thirdLawDeviation: 1,
        maxNumberConcentration: 1
      };
    }
    return {
      tableGate: warmup.tableGate,
      riskLabel: warmup.riskLabel,
      completeness: warmup.sample.completeness,
      normalizedEntropy: warmup.metrics.normalizedEntropy,
      thirdLawDeviation: warmup.metrics.thirdLawDeviation,
      maxNumberConcentration: warmup.metrics.maxNumberConcentration
    };
  }
}
