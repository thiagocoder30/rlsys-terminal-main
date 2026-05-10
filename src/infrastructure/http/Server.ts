import express, { Express, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { GeminiAdapter } from '../adapters/GeminiAdapter';
import { StrategyEngine } from '../../domain/services/StrategyEngine';
import { RouletteStats } from '../../domain/services/RouletteStats';
import { ISignalRepository } from '../../domain/math/ISignalRepository';
import { BacktestEngine } from '../../domain/services/BacktestEngine';
import { RiskPolicy } from '../../domain/services/RiskPolicy';
import { ConfidenceScorer } from '../../domain/services/ConfidenceScorer';
import { MonteCarloEngine } from '../../domain/services/MonteCarloEngine';
import { DecisionAuditLogger } from '../audit/DecisionAuditLogger';
import { BayesianEdgeValidator } from '../../domain/services/BayesianEdgeValidator';
import { RegimeDetector } from '../../domain/services/RegimeDetector';
import { StructuredLogger } from '../observability/StructuredLogger';
import { MetricsRegistry } from '../observability/MetricsRegistry';
import { HealthCheckService } from '../../application/health/HealthCheckService';
import { ConfigValidator } from '../../application/config/ConfigValidator';
import { ReleaseReadinessService } from '../../application/release/ReleaseReadinessService';
import { securityHeaders } from './middleware/securityHeaders';
import { ResearchDatasetService } from '../../application/research/ResearchDatasetService';
import { StatisticalResearchService } from '../../application/research/StatisticalResearchService';
import { SequentialResearchService } from '../../application/research/SequentialResearchService';
import { PersistenceResearchService } from '../../application/research/PersistenceResearchService';
import { ResearchReportingService } from '../../application/research/ResearchReportingService';
import { InstitutionalBacktestService } from '../../application/backtesting/InstitutionalBacktestService';
import { AdvancedWalkForwardService } from '../../application/backtesting/AdvancedWalkForwardService';
import { StressScenarioService } from '../../application/backtesting/StressScenarioService';
import { CapitalExposureService } from '../../application/backtesting/CapitalExposureService';
import { MonteCarloV2Service } from '../../application/backtesting/MonteCarloV2Service';
import { BenchmarkComparisonService } from '../../application/backtesting/BenchmarkComparisonService';
import { WarmupSessionService } from '../../application/session/WarmupSessionService';
import { StrategyDecisionService } from '../../application/decision/StrategyDecisionService';
import { LiveSessionRuntimeService } from '../../application/session/LiveSessionRuntimeService';
import { config } from '../../config';

interface AnalyzePayload {
  history?: unknown;
  values?: unknown;
  sequencia?: unknown;
  bankroll?: number;
  image?: string;
}

export class Server {
  private readonly app: Express;
  private readonly engine: StrategyEngine;
  private readonly validator = RouletteStats;
  private readonly backtestEngine = new BacktestEngine();
  private readonly riskPolicy = new RiskPolicy();
  private readonly confidenceScorer = new ConfidenceScorer();
  private readonly monteCarloEngine = new MonteCarloEngine();
  private readonly logger = new StructuredLogger('rl-sys-core', config.logLevel as any);
  private readonly metrics = new MetricsRegistry('rl-sys-core', config.appVersion);
  private readonly healthCheck = new HealthCheckService(config.appVersion, config.dataPath);
  private readonly configValidator = new ConfigValidator();
  private readonly releaseReadiness = new ReleaseReadinessService(config.appVersion);
  private readonly auditLogger = new DecisionAuditLogger(config.auditLogPath);
  private readonly bayesianEdgeValidator = new BayesianEdgeValidator();
  private readonly regimeDetector = new RegimeDetector();
  private readonly researchDatasetService = new ResearchDatasetService();
  private readonly statisticalResearchService = new StatisticalResearchService();
  private readonly sequentialResearchService = new SequentialResearchService();
  private readonly persistenceResearchService = new PersistenceResearchService();
  private readonly researchReportingService = new ResearchReportingService(config.appVersion);
  private readonly institutionalBacktestService = new InstitutionalBacktestService();
  private readonly advancedWalkForwardService = new AdvancedWalkForwardService();
  private readonly stressScenarioService = new StressScenarioService();
  private readonly capitalExposureService = new CapitalExposureService();
  private readonly monteCarloV2Service = new MonteCarloV2Service();
  private readonly benchmarkComparisonService = new BenchmarkComparisonService();
  private readonly warmupSessionService = new WarmupSessionService();
  private readonly strategyDecisionService = new StrategyDecisionService();
  private readonly liveSessionRuntimeService = new LiveSessionRuntimeService();
  private httpServer?: ReturnType<Express['listen']>;

  constructor(
    private readonly port: number,
    private readonly host: string,
    private readonly gemini: GeminiAdapter,
    private readonly signalRepository?: ISignalRepository
  ) {
    this.app = express();
    this.engine = new StrategyEngine();
    this.configure();
    this.routes();
  }

  public start(): void {
    this.httpServer = this.app.listen(this.port, this.host, () => {
      this.logger.info('http_server_started', { host: this.host, port: this.port });
    });
  }

  public async stop(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      if (!this.httpServer) return resolve();
      this.httpServer.close(error => error ? reject(error) : resolve());
    });
  }

  private configure(): void {
    this.app.disable('x-powered-by');
    this.app.use(securityHeaders);
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    this.app.use(express.static(path.resolve(process.cwd())));
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
        } else {
          this.logger.debug('http_request_completed', { method: req.method, path: req.path, statusCode: res.statusCode, durationMs });
        }
      });

      next();
    });
  }

  private routes(): void {
    const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

    this.app.get('/health', (_req, res) => {
      res.json({ status: 'ok', service: 'rl-sys-core', version: config.appVersion, timestamp: new Date().toISOString() });
    });

    this.app.get('/api/strategy/health', (_req, res) => {
      res.json({
        status: 'ok',
        service: 'rl-sys-core',
        version: config.appVersion,
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
      res.json(this.configValidator.validate(config).sanitized);
    });

    this.app.get('/api/system/release-readiness', async (_req, res) => {
      const configState = this.configValidator.validate(config);
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

    this.app.post('/api/vision/warmup/analyze', upload.single('image'), async (req: Request, res: Response) => {
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
      } catch (error: unknown) {
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

    this.app.post('/api/vision/analyze', upload.single('image'), async (req: Request, res: Response) => {
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
      } catch (error: any) {
        return res.status(500).json({ status: 'ERROR', reason: error.message || 'Falha na análise de imagem.' });
      }
    });
  }

  private async analyzeHistory(req: Request<unknown, unknown, AnalyzePayload>, res: Response): Promise<Response | void> {
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

  private async runAnalysis(historyInput: unknown, bankroll: number, res: Response, rawVision?: string): Promise<Response> {
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

  private safeJson(raw: string): any {
    const cleaned = raw.replace(/```json/g, '').replace(/```/g, '').trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end === -1) throw new Error('Resposta da visão não contém JSON válido.');
    return JSON.parse(cleaned.slice(start, end + 1));
  }

  private defaultVisionPrompt(): string {
    return 'Extraia somente números de roleta europeia de 0 a 36. Responda JSON puro no formato {"sequencia":[number],"total":number}. Não invente números ilegíveis.';
  }

  private defaultWarmupVisionPrompt(): string {
    return 'Extraia as últimas 100 rodadas visíveis da roleta europeia, preservando a ordem temporal do mais antigo para o mais recente quando possível. Responda apenas JSON puro no formato {"total":number,"sequencia":[number]}. Aceite somente inteiros 0-36 e não invente números ilegíveis.';
  }
}
