"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StrategyDecisionService = void 0;
const BenchmarkComparisonService_1 = require("../backtesting/BenchmarkComparisonService");
const CapitalExposureService_1 = require("../backtesting/CapitalExposureService");
const MonteCarloV2Service_1 = require("../backtesting/MonteCarloV2Service");
const WarmupSessionService_1 = require("../session/WarmupSessionService");
const DatasetEngine_1 = require("../../domain/research/DatasetEngine");
const StrategyEngine_1 = require("../../domain/services/StrategyEngine");
const StrategyDecisionEngine_1 = require("../../domain/decision/StrategyDecisionEngine");
/**
 * Application boundary for the operational decision layer.
 *
 * It adapts user/session input into canonical snapshots and delegates the actual decision
 * to the domain-only StrategyDecisionEngine. Heavy simulations are executed only when
 * enough data exists, keeping the flow deterministic and safe for mobile hardware.
 */
class StrategyDecisionService {
    constructor() {
        this.datasetEngine = new DatasetEngine_1.DatasetEngine();
        this.warmupService = new WarmupSessionService_1.WarmupSessionService();
        this.strategyEngine = new StrategyEngine_1.StrategyEngine();
        this.benchmarkService = new BenchmarkComparisonService_1.BenchmarkComparisonService();
        this.capitalService = new CapitalExposureService_1.CapitalExposureService();
        this.monteCarloService = new MonteCarloV2Service_1.MonteCarloV2Service();
        this.decisionEngine = new StrategyDecisionEngine_1.StrategyDecisionEngine();
    }
    evaluate(input) {
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
        const context = {
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
    normalizeInput(input) {
        if (Array.isArray(input))
            return { values: input.filter((item) => typeof item === 'number') };
        if (input && typeof input === 'object')
            return input;
        return { dataset: input };
    }
    safeStrategy(values) {
        try {
            const analysis = this.strategyEngine.analyze([...values]);
            if (!analysis) {
                return { status: 'INSUFFICIENT_SAMPLE', sampleSize: values.length, signalCount: 0, maxSignalConfidence: 0, suggestedFraction: 0, riskLevel: 'CRITICAL' };
            }
            return this.mapStrategy(analysis);
        }
        catch (_error) {
            return { status: 'DENIED', sampleSize: values.length, signalCount: 0, maxSignalConfidence: 0, suggestedFraction: 0, riskLevel: 'CRITICAL' };
        }
    }
    mapStrategy(analysis) {
        return {
            status: analysis.status,
            sampleSize: analysis.metrics.sampleSize,
            signalCount: analysis.signals.length,
            maxSignalConfidence: analysis.signals.length === 0 ? 0 : Math.max(...analysis.signals.map(signal => signal.confidence)),
            suggestedFraction: analysis.suggestedFraction,
            riskLevel: analysis.risk.level
        };
    }
    safeBenchmark(values) {
        try {
            const report = this.benchmarkService.evaluate([...values]);
            return {
                verdict: report.benchmark?.governance.verdict ?? 'UNAVAILABLE',
                benchmarkScore: report.benchmark?.comparison.benchmarkScore ?? 0,
                relativeEdge: report.benchmark?.comparison.relativeEdge ?? 0,
                baselineDominanceRisk: report.benchmark?.comparison.baselineDominanceRisk ?? 1,
                beatRateByCandidate: report.benchmark?.randomBaseline.beatRateByCandidate ?? 0
            };
        }
        catch (_error) {
            return { verdict: 'UNAVAILABLE', benchmarkScore: 0, relativeEdge: 0, baselineDominanceRisk: 1, beatRateByCandidate: 0 };
        }
    }
    safeCapital(values) {
        try {
            const report = this.capitalService.evaluate([...values]);
            return {
                reviewStatus: report.analysis?.summary.governance.reviewStatus ?? 'UNAVAILABLE',
                ruinProbability: report.analysis?.summary.worstRuinProbability ?? 1,
                worstDrawdown: report.analysis?.summary.worstDrawdown ?? 1,
                exposureSaturation: report.analysis?.summary.maxExposureSaturation ?? 1,
                circuitBreakerCount: report.analysis?.summary.governance.circuitBreakers.length ?? 0
            };
        }
        catch (_error) {
            return { reviewStatus: 'UNAVAILABLE', ruinProbability: 1, worstDrawdown: 1, exposureSaturation: 1, circuitBreakerCount: 0 };
        }
    }
    safeMonteCarlo(values) {
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
        }
        catch (_error) {
            return { reviewStatus: 'UNAVAILABLE', robustnessScore: 0, ruinProbability: 1, p95MaxDrawdown: 1, sequenceDependencyRisk: 1, tailRisk: 'UNAVAILABLE' };
        }
    }
    mapWarmup(report) {
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
exports.StrategyDecisionService = StrategyDecisionService;
