"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Server = void 0;
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const StrategyEngine_1 = require("../../domain/services/StrategyEngine");
const RouletteStats_1 = require("../../domain/services/RouletteStats");
const BacktestEngine_1 = require("../../domain/services/BacktestEngine");
const RiskPolicy_1 = require("../../domain/services/RiskPolicy");
const ConfidenceScorer_1 = require("../../domain/services/ConfidenceScorer");
const MonteCarloEngine_1 = require("../../domain/services/MonteCarloEngine");
const DecisionAuditLogger_1 = require("../audit/DecisionAuditLogger");
const BayesianEdgeValidator_1 = require("../../domain/services/BayesianEdgeValidator");
const RegimeDetector_1 = require("../../domain/services/RegimeDetector");
const StructuredLogger_1 = require("../observability/StructuredLogger");
const MetricsRegistry_1 = require("../observability/MetricsRegistry");
const HealthCheckService_1 = require("../../application/health/HealthCheckService");
const ConfigValidator_1 = require("../../application/config/ConfigValidator");
const ReleaseReadinessService_1 = require("../../application/release/ReleaseReadinessService");
const securityHeaders_1 = require("./middleware/securityHeaders");
const ResearchDatasetService_1 = require("../../application/research/ResearchDatasetService");
const StatisticalResearchService_1 = require("../../application/research/StatisticalResearchService");
const SequentialResearchService_1 = require("../../application/research/SequentialResearchService");
const PersistenceResearchService_1 = require("../../application/research/PersistenceResearchService");
const ResearchReportingService_1 = require("../../application/research/ResearchReportingService");
const InstitutionalBacktestService_1 = require("../../application/backtesting/InstitutionalBacktestService");
const AdvancedWalkForwardService_1 = require("../../application/backtesting/AdvancedWalkForwardService");
const StressScenarioService_1 = require("../../application/backtesting/StressScenarioService");
const CapitalExposureService_1 = require("../../application/backtesting/CapitalExposureService");
const MonteCarloV2Service_1 = require("../../application/backtesting/MonteCarloV2Service");
const BenchmarkComparisonService_1 = require("../../application/backtesting/BenchmarkComparisonService");
const WarmupSessionService_1 = require("../../application/session/WarmupSessionService");
const StrategyDecisionService_1 = require("../../application/decision/StrategyDecisionService");
const LiveSessionRuntimeService_1 = require("../../application/session/LiveSessionRuntimeService");
const config_1 = require("../../config");
class Server {
    constructor(port, host, gemini, signalRepository) {
        this.port = port;
        this.host = host;
        this.gemini = gemini;
        this.signalRepository = signalRepository;
        this.validator = RouletteStats_1.RouletteStats;
        this.backtestEngine = new BacktestEngine_1.BacktestEngine();
        this.riskPolicy = new RiskPolicy_1.RiskPolicy();
        this.confidenceScorer = new ConfidenceScorer_1.ConfidenceScorer();
        this.monteCarloEngine = new MonteCarloEngine_1.MonteCarloEngine();
        this.logger = new StructuredLogger_1.StructuredLogger('rl-sys-core', config_1.config.logLevel);
        this.metrics = new MetricsRegistry_1.MetricsRegistry('rl-sys-core', config_1.config.appVersion);
        this.healthCheck = new HealthCheckService_1.HealthCheckService(config_1.config.appVersion, config_1.config.dataPath);
        this.configValidator = new ConfigValidator_1.ConfigValidator();
        this.releaseReadiness = new ReleaseReadinessService_1.ReleaseReadinessService(config_1.config.appVersion);
        this.auditLogger = new DecisionAuditLogger_1.DecisionAuditLogger(config_1.config.auditLogPath);
        this.bayesianEdgeValidator = new BayesianEdgeValidator_1.BayesianEdgeValidator();
        this.regimeDetector = new RegimeDetector_1.RegimeDetector();
        this.researchDatasetService = new ResearchDatasetService_1.ResearchDatasetService();
        this.statisticalResearchService = new StatisticalResearchService_1.StatisticalResearchService();
        this.sequentialResearchService = new SequentialResearchService_1.SequentialResearchService();
        this.persistenceResearchService = new PersistenceResearchService_1.PersistenceResearchService();
        this.researchReportingService = new ResearchReportingService_1.ResearchReportingService(config_1.config.appVersion);
        this.institutionalBacktestService = new InstitutionalBacktestService_1.InstitutionalBacktestService();
        this.advancedWalkForwardService = new AdvancedWalkForwardService_1.AdvancedWalkForwardService();
        this.stressScenarioService = new StressScenarioService_1.StressScenarioService();
        this.capitalExposureService = new CapitalExposureService_1.CapitalExposureService();
        this.monteCarloV2Service = new MonteCarloV2Service_1.MonteCarloV2Service();
        this.benchmarkComparisonService = new BenchmarkComparisonService_1.BenchmarkComparisonService();
        this.warmupSessionService = new WarmupSessionService_1.WarmupSessionService();
        this.strategyDecisionService = new StrategyDecisionService_1.StrategyDecisionService();
        this.liveSessionRuntimeService = new LiveSessionRuntimeService_1.LiveSessionRuntimeService();
        this.app = (0, express_1.default)();
        this.engine = new StrategyEngine_1.StrategyEngine();
        this.configure();
        this.routes();
    }
    start() {
        this.httpServer = this.app.listen(this.port, this.host, () => {
            this.logger.info('http_server_started', { host: this.host, port: this.port });
        });
    }
    async stop() {
        await new Promise((resolve, reject) => {
            if (!this.httpServer)
                return resolve();
            this.httpServer.close(error => error ? reject(error) : resolve());
        });
    }
    configure() {
        this.app.disable('x-powered-by');
        this.app.use(securityHeaders_1.securityHeaders);
        this.app.use(express_1.default.json({ limit: '10mb' }));
        this.app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
        this.app.use(express_1.default.static(path_1.default.resolve(process.cwd())));
        this.app.use((req, res, next) => {
            const startedAt = Date.now();
            this.metrics.increment('http.requests.total');
            res.on('finish', () => {
                const durationMs = Date.now() - startedAt;
                this.metrics.observeDuration('http.request.duration_ms', durationMs);
                this.metrics.increment(`http.status.${res.statusCode}`);
                if (res.statusCode >= 500) {
                    this.metrics.increment('http.errors.total');
                    this.logger.error('http_request_failed', { method: req.method, path: req.path, statusCode: res.statusCode, durationMs });
                }
                else {
                    this.logger.debug('http_request_completed', { method: req.method, path: req.path, statusCode: res.statusCode, durationMs });
                }
            });
            next();
        });
    }
    routes() {
        const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });
        this.app.get('/health', (_req, res) => {
            res.json({ status: 'ok', service: 'rl-sys-core', version: config_1.config.appVersion, timestamp: new Date().toISOString() });
        });
        this.app.get('/api/strategy/health', (_req, res) => {
            res.json({
                status: 'ok',
                service: 'rl-sys-core',
                version: config_1.config.appVersion,
                capabilities: [
                    'walk-forward-backtest',
                    'monte-carlo-risk',
                    'confidence-scoring',
                    'bayesian-edge-validation',
                    'regime-detection',
                    'decision-audit',
                    'structured-logging',
                    'runtime-metrics',
                    'readiness-checks',
                    'research-dataset-integrity',
                    'statistical-significance-engine',
                    'hypothesis-validation',
                    'sequential-bias-detection',
                    'transition-matrix-analysis',
                    'temporal-clustering-analysis',
                    'edge-persistence-analysis',
                    'edge-decay-modeling',
                    'out-of-sample-consistency',
                    'unified-research-reporting',
                    'reproducible-research-envelope',
                    'research-audit-trail',
                    'institutional-backtesting',
                    'baseline-comparison',
                    'stress-scenario-analysis',
                    'drawdown-surface-analysis',
                    'advanced-walk-forward-validation',
                    'out-of-sample-consistency-analysis',
                    'overfit-risk-scoring',
                    'stress-scenario-engine',
                    'drawdown-surface-analysis-v2',
                    'tail-risk-analysis',
                    'capital-exposure-stress',
                    'recovery-factor-analysis',
                    'capital-exposure-simulation',
                    'advanced-risk-of-ruin',
                    'equity-curve-simulation',
                    'underwater-curve-analysis',
                    'exposure-throttling-governance',
                    'monte-carlo-v2',
                    'bootstrap-resampling',
                    'confidence-bands',
                    'sequence-dependency-risk',
                    'tail-risk-bootstrap-analysis',
                    'strategy-benchmarking',
                    'random-baseline-validation',
                    'relative-edge-scoring',
                    'baseline-dominance-risk',
                    'warmup-session-analysis',
                    'vision-warmup-normalization',
                    'one-hundred-round-table-gating',
                    'strategy-decision-engine',
                    'paper-trading-execution-plan',
                    'operational-decision-governance',
                    'live-session-runtime',
                    'incremental-round-ingestion',
                    'idempotent-live-event-processing',
                    'bounded-memory-session-state'
                ],
                gates: {
                    minSampleSize: 120,
                    minWalkForwardTrades: 30,
                    maxMonteCarloRuin: 0.05,
                    minConfidenceScore: 0.55,
                    bayesianPolicy: 'block unless posterior edge is supported',
                    regimePolicy: 'block unstable statistical regimes'
                },
                timestamp: new Date().toISOString()
            });
        });
        this.app.get('/api/strategy/metrics', (_req, res) => {
            res.json(this.metrics.snapshot());
        });
        this.app.get('/api/strategy/readiness', async (_req, res) => {
            const readiness = await this.healthCheck.readiness();
            res.status(readiness.status === 'ok' ? 200 : 503).json(readiness);
        });
        this.app.get('/api/system/config', (_req, res) => {
            res.json(this.configValidator.validate(config_1.config).sanitized);
        });
        this.app.get('/api/system/release-readiness', async (_req, res) => {
            const configState = this.configValidator.validate(config_1.config);
            const health = await this.healthCheck.readiness();
            const readiness = this.releaseReadiness.evaluate({
                config: configState,
                health,
                metrics: this.metrics.snapshot()
            });
            res.status(readiness.status === 'blocked' ? 503 : 200).json(readiness);
        });
        this.app.post('/api/research/dataset/evaluate', (req, res) => {
            const dataset = req.body?.dataset ?? req.body?.records ?? req.body?.history ?? req.body;
            const report = this.researchDatasetService.evaluate(dataset);
            this.metrics.increment(`research.dataset.${report.status.toLowerCase()}`);
            res.status(report.status === 'REJECTED' ? 422 : 200).json(report);
        });
        this.app.post('/api/research/statistics/evaluate', (req, res) => {
            const dataset = req.body?.dataset ?? req.body?.records ?? req.body?.history ?? req.body;
            const report = this.statisticalResearchService.evaluate(dataset);
            this.metrics.increment(`research.statistics.${report.status.toLowerCase()}`);
            res.status(report.status === 'REJECTED' ? 422 : 200).json(report);
        });
        this.app.post('/api/research/sequential/evaluate', (req, res) => {
            const dataset = req.body?.dataset ?? req.body?.records ?? req.body?.history ?? req.body;
            const report = this.sequentialResearchService.evaluate(dataset);
            this.metrics.increment(`research.sequential.${report.status.toLowerCase()}`);
            res.status(report.status === 'REJECTED' ? 422 : 200).json(report);
        });
        this.app.post('/api/research/persistence/evaluate', (req, res) => {
            const dataset = req.body?.dataset ?? req.body?.records ?? req.body?.history ?? req.body;
            const report = this.persistenceResearchService.evaluate(dataset);
            this.metrics.increment(`research.persistence.${report.status.toLowerCase()}`);
            res.status(report.status === 'REJECTED' ? 422 : 200).json(report);
        });
        this.app.post('/api/research/report/evaluate', (req, res) => {
            const dataset = req.body?.dataset ?? req.body?.records ?? req.body?.history ?? req.body;
            const report = this.researchReportingService.evaluate(dataset);
            this.metrics.increment(`research.report.${report.executiveSummary.status.toLowerCase()}`);
            res.status(report.executiveSummary.status === 'REJECTED' ? 422 : 200).json(report);
        });
        this.app.post('/api/backtest/institutional/evaluate', (req, res) => {
            const dataset = req.body?.dataset ?? req.body?.records ?? req.body?.history ?? req.body;
            const report = this.institutionalBacktestService.evaluate(dataset);
            this.metrics.increment(`backtest.institutional.${report.status.toLowerCase()}`);
            res.status(report.status === 'REJECTED' ? 422 : 200).json(report);
        });
        this.app.post('/api/backtest/walk-forward/advanced/evaluate', (req, res) => {
            const dataset = req.body?.dataset ?? req.body?.records ?? req.body?.history ?? req.body;
            const report = this.advancedWalkForwardService.evaluate(dataset);
            this.metrics.increment(`backtest.walk_forward_advanced.${report.status.toLowerCase()}`);
            res.status(report.status === 'REJECTED' ? 422 : 200).json(report);
        });
        this.app.post('/api/backtest/stress/evaluate', (req, res) => {
            const dataset = req.body?.dataset ?? req.body?.records ?? req.body?.history ?? req.body;
            const report = this.stressScenarioService.evaluate(dataset);
            this.metrics.increment(`backtest.stress.${report.status.toLowerCase()}`);
            res.status(report.status === 'REJECTED' ? 422 : 200).json(report);
        });
        this.app.post('/api/backtest/capital-exposure/evaluate', (req, res) => {
            const dataset = req.body?.dataset ?? req.body?.records ?? req.body?.history ?? req.body;
            const report = this.capitalExposureService.evaluate(dataset);
            this.metrics.increment(`backtest.capital_exposure.${report.status.toLowerCase()}`);
            res.status(report.status === 'REJECTED' ? 422 : 200).json(report);
        });
        this.app.post('/api/backtest/monte-carlo/v2/evaluate', (req, res) => {
            const dataset = req.body?.dataset ?? req.body?.records ?? req.body?.history ?? req.body;
            const report = this.monteCarloV2Service.evaluate(dataset);
            this.metrics.increment(`backtest.monte_carlo_v2.${report.status.toLowerCase()}`);
            res.status(report.status === 'REJECTED' ? 422 : 200).json(report);
        });
        this.app.post('/api/backtest/benchmark/evaluate', (req, res) => {
            const dataset = req.body?.dataset ?? req.body?.records ?? req.body?.history ?? req.body;
            const report = this.benchmarkComparisonService.evaluate(dataset);
            this.metrics.increment(`backtest.benchmark.${report.status.toLowerCase()}`);
            res.status(report.status === 'REJECTED' ? 422 : 200).json(report);
        });
        this.app.post('/api/session/warmup/evaluate', (req, res) => {
            const report = this.warmupSessionService.evaluate({
                source: req.body?.source ?? 'dataset',
                dataset: req.body?.dataset ?? req.body?.records ?? req.body?.history ?? req.body?.values ?? req.body,
                values: Array.isArray(req.body?.values) ? req.body.values : undefined,
                visionRaw: req.body?.visionRaw ?? req.body?.vision ?? req.body?.ocr
            });
            this.metrics.increment(`session.warmup.${report.status.toLowerCase()}`);
            res.status(report.status === 'REJECTED' ? 422 : 200).json(report);
        });
        this.app.post('/api/vision/warmup/analyze', upload.single('image'), async (req, res) => {
            try {
                const prompt = req.body.prompt || this.defaultWarmupVisionPrompt();
                const base64 = req.file?.buffer.toString('base64') || req.body.image;
                const mimeType = req.file?.mimetype || req.body.mimeType || 'image/jpeg';
                if (!base64) {
                    return res.status(400).json({ status: 'REJECTED', reason: 'Imagem não enviada para warm-up.' });
                }
                const raw = await this.gemini.analyzeImage(base64, mimeType, prompt);
                const report = this.warmupSessionService.evaluate({ source: 'vision', visionRaw: raw });
                this.metrics.increment(`vision.warmup.${report.status.toLowerCase()}`);
                return res.status(report.status === 'REJECTED' ? 422 : 200).json({ ...report, rawVision: raw });
            }
            catch (error) {
                const message = error instanceof Error ? error.message : 'Falha na análise de warm-up por imagem.';
                return res.status(500).json({ status: 'ERROR', reason: message });
            }
        });
        this.app.post('/api/session/live/round', (req, res) => {
            const report = this.liveSessionRuntimeService.ingest({
                sessionId: typeof req.body?.sessionId === 'string' ? req.body.sessionId : undefined,
                value: Number(req.body?.value),
                eventId: typeof req.body?.eventId === 'string' ? req.body.eventId : undefined,
                sequence: Number.isInteger(req.body?.sequence) ? req.body.sequence : undefined,
                occurredAt: typeof req.body?.occurredAt === 'string' ? req.body.occurredAt : undefined,
                bankroll: Number(req.body?.bankroll ?? 0)
            });
            this.metrics.increment(`session.live.${report.status.toLowerCase()}`);
            res.status(report.status === 'REJECTED' ? 422 : 200).json(report);
        });
        this.app.get('/api/session/live/:sessionId', (req, res) => {
            const report = this.liveSessionRuntimeService.snapshot(req.params.sessionId);
            this.metrics.increment(`session.live.snapshot.${report.status.toLowerCase()}`);
            res.status(report.status === 'REJECTED' ? 404 : 200).json(report);
        });
        this.app.post('/api/strategy/decision/evaluate', (req, res) => {
            const report = this.strategyDecisionService.evaluate({
                source: req.body?.source,
                dataset: req.body?.dataset ?? req.body?.records ?? req.body?.history ?? req.body?.values ?? req.body,
                history: req.body?.history,
                records: req.body?.records,
                values: Array.isArray(req.body?.values) ? req.body.values : undefined,
                visionRaw: req.body?.visionRaw ?? req.body?.vision ?? req.body?.ocr,
                bankroll: Number(req.body?.bankroll ?? 0),
                sessionId: typeof req.body?.sessionId === 'string' ? req.body.sessionId : undefined
            });
            this.metrics.increment(`strategy.decision.${report.status.toLowerCase()}`);
            res.status(report.status === 'REJECTED' ? 422 : 200).json(report);
        });
        this.app.post('/api/strategy/analyze', async (req, res) => this.analyzeHistory(req, res));
        this.app.post('/upload-history', async (req, res) => this.analyzeHistory(req, res));
        this.app.post('/api/vision/analyze', upload.single('image'), async (req, res) => {
            try {
                const prompt = req.body.prompt || this.defaultVisionPrompt();
                const base64 = req.file?.buffer.toString('base64') || req.body.image;
                const mimeType = req.file?.mimetype || req.body.mimeType || 'image/jpeg';
                if (!base64) {
                    return res.status(400).json({ status: 'DENIED', reason: 'Imagem não enviada.' });
                }
                const raw = await this.gemini.analyzeImage(base64, mimeType, prompt);
                const parsed = this.safeJson(raw);
                const history = parsed?.sequencia ?? parsed?.history ?? parsed?.values;
                return this.runAnalysis(history, Number(req.body.bankroll ?? 0), res, raw);
            }
            catch (error) {
                return res.status(500).json({ status: 'ERROR', reason: error.message || 'Falha na análise de imagem.' });
            }
        });
    }
    async analyzeHistory(req, res) {
        const payload = req.body;
        const history = payload.history ?? payload.values ?? payload.sequencia;
        if (history) {
            return this.runAnalysis(history, Number(payload.bankroll ?? 0), res);
        }
        if (payload.image) {
            const raw = await this.gemini.analyzeImage(payload.image, 'image/jpeg', this.defaultVisionPrompt());
            const parsed = this.safeJson(raw);
            return this.runAnalysis(parsed?.sequencia ?? parsed?.history ?? parsed?.values, Number(payload.bankroll ?? 0), res, raw);
        }
        return res.status(400).json({ status: 'DENIED', reason: 'Envie history, values, sequencia ou image.' });
    }
    async runAnalysis(historyInput, bankroll, res, rawVision) {
        this.metrics.increment('strategy.analysis.requested');
        const analysisStartedAt = Date.now();
        const validation = this.validator.validate(historyInput);
        if (!validation.ok) {
            this.metrics.increment('strategy.analysis.denied.validation');
            this.logger.warn('strategy_analysis_validation_failed', { errors: validation.errors.slice(0, 5) });
            return res.status(422).json({ status: 'DENIED', reason: 'Histórico inválido.', errors: validation.errors.slice(0, 20) });
        }
        const analysis = this.engine.analyze(validation.values);
        if (!analysis) {
            this.metrics.increment('strategy.analysis.denied.sample_size');
            return res.status(400).json({ status: 'DENIED', reason: 'Amostra insuficiente. Mínimo institucional: 120 giros válidos.' });
        }
        const backtest = validation.values.length >= 180
            ? this.backtestEngine.runWalkForward(validation.values).summary
            : undefined;
        const monteCarlo = backtest ? this.monteCarloEngine.runFromBacktest(backtest) : undefined;
        const confidence = this.confidenceScorer.score(analysis, backtest);
        const bayesianEdge = this.bayesianEdgeValidator.validate(analysis, backtest);
        const regime = this.regimeDetector.detect(validation.values);
        const riskDecision = this.riskPolicy.evaluate(analysis, backtest, confidence, monteCarlo, bayesianEdge, regime);
        if (this.signalRepository) {
            await this.signalRepository.saveSignal({
                type: 'STRATEGY_ANALYSIS',
                value: JSON.stringify(validation.values.slice(-20)),
                timestamp: Date.now(),
                analysis: JSON.stringify({ analysis, backtest, confidence, monteCarlo, bayesianEdge, regime, riskDecision })
            });
        }
        await this.auditLogger.append({
            timestamp: new Date().toISOString(),
            status: riskDecision.allowed ? analysis.status : 'LOCKED',
            reason: riskDecision.reason,
            sampleSize: analysis.metrics.sampleSize,
            confidenceScore: confidence.finalScore,
            riskLevel: analysis.risk.level,
            stakeFraction: riskDecision.allowed ? analysis.suggestedFraction : 0,
            riskOfRuin: monteCarlo?.probabilityOfRuin,
            bayesianVerdict: bayesianEdge.verdict,
            probabilityEdgePositive: bayesianEdge.probabilityEdgePositive,
            regimeLabel: regime.label,
            regimeStabilityScore: regime.stabilityScore
        });
        this.metrics.increment(riskDecision.allowed ? 'strategy.analysis.allowed' : 'strategy.analysis.locked');
        this.metrics.observeDuration('strategy.analysis.duration_ms', Date.now() - analysisStartedAt);
        this.logger.info('strategy_analysis_completed', {
            status: riskDecision.allowed ? analysis.status : 'LOCKED',
            reason: riskDecision.reason,
            sampleSize: analysis.metrics.sampleSize,
            confidenceScore: confidence.finalScore,
            riskOfRuin: monteCarlo?.probabilityOfRuin,
            bayesianVerdict: bayesianEdge.verdict,
            regimeLabel: regime.label
        });
        const effectiveFraction = riskDecision.allowed ? analysis.suggestedFraction : 0;
        const unitStake = bankroll > 0 ? bankroll * effectiveFraction : 0;
        return res.json({
            ...analysis,
            status: riskDecision.allowed ? analysis.status : 'LOCKED',
            reason: riskDecision.reason,
            capital: {
                bankroll,
                unitStake: Number(unitStake.toFixed(2)),
                effectiveFraction,
                maxDrawdown: bankroll > 0 ? Number((bankroll * 0.15).toFixed(2)) : 0,
                targetProfit: bankroll > 0 ? Number((bankroll * 0.2).toFixed(2)) : 0
            },
            backtest,
            confidence,
            monteCarlo,
            bayesianEdge,
            regime,
            institutionalRisk: riskDecision,
            rawVision
        });
    }
    safeJson(raw) {
        const cleaned = raw.replace(/```json/g, '').replace(/```/g, '').trim();
        const start = cleaned.indexOf('{');
        const end = cleaned.lastIndexOf('}');
        if (start === -1 || end === -1)
            throw new Error('Resposta da visão não contém JSON válido.');
        return JSON.parse(cleaned.slice(start, end + 1));
    }
    defaultVisionPrompt() {
        return 'Extraia somente números de roleta europeia de 0 a 36. Responda JSON puro no formato {"sequencia":[number],"total":number}. Não invente números ilegíveis.';
    }
    defaultWarmupVisionPrompt() {
        return 'Extraia as últimas 100 rodadas visíveis da roleta europeia, preservando a ordem temporal do mais antigo para o mais recente quando possível. Responda apenas JSON puro no formato {"total":number,"sequencia":[number]}. Aceite somente inteiros 0-36 e não invente números ilegíveis.';
    }
}
exports.Server = Server;
