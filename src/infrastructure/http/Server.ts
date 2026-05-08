import express, { Express, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { GeminiAdapter } from '../adapters/GeminiAdapter';
import { StrategyEngine } from '../../domain/services/StrategyEngine';
import { RouletteStats } from '../../domain/services/RouletteStats';
import { ISignalRepository } from '../../domain/math/ISignalRepository';

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
      console.log(`RL.SYS API listening at http://${this.host}:${this.port}`);
    });
  }

  public async stop(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      if (!this.httpServer) return resolve();
      this.httpServer.close(error => error ? reject(error) : resolve());
    });
  }

  private configure(): void {
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    this.app.use(express.static(path.resolve(process.cwd())));
  }

  private routes(): void {
    const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

    this.app.get('/health', (_req, res) => {
      res.json({ status: 'ok', service: 'rl-sys-core', timestamp: new Date().toISOString() });
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
    const validation = this.validator.validate(historyInput);
    if (!validation.ok) {
      return res.status(422).json({ status: 'DENIED', reason: 'Histórico inválido.', errors: validation.errors.slice(0, 20) });
    }

    const analysis = this.engine.analyze(validation.values);
    if (!analysis) {
      return res.status(400).json({ status: 'DENIED', reason: 'Amostra insuficiente. Mínimo institucional: 120 giros válidos.' });
    }

    if (this.signalRepository) {
      await this.signalRepository.saveSignal({
        type: 'STRATEGY_ANALYSIS',
        value: JSON.stringify(validation.values.slice(-20)),
        timestamp: Date.now(),
        analysis: JSON.stringify(analysis)
      });
    }

    const unitStake = bankroll > 0 ? bankroll * analysis.suggestedFraction : 0;
    return res.json({
      ...analysis,
      capital: {
        bankroll,
        unitStake: Number(unitStake.toFixed(2)),
        maxDrawdown: bankroll > 0 ? Number((bankroll * 0.15).toFixed(2)) : 0,
        targetProfit: bankroll > 0 ? Number((bankroll * 0.2).toFixed(2)) : 0
      },
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
}
