import { OcrCoverageProfiler } from '../ocr/OcrCoverageProfiler.js';
import { AnalyticsDecisionEngine } from './AnalyticsDecisionEngine.js';
import { WarmupGeminiExtractorIntegration } from './WarmupGeminiExtractorIntegration.js';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

import type {
  PaperEntryLedgerRepositoryPort,
} from '../ledger/PaperEntryLedgerRepositoryPort.js';
import {
  PaperTradingRepeatSessionStarter,
} from './PaperTradingRepeatSessionStarter.js';
import {
  FirstPaperSessionClosingProtocol,
} from './FirstPaperSessionClosingProtocol.js';
import {
  FirstCompletePaperSessionCertification,
} from './FirstCompletePaperSessionCertification.js';
import {
  WarmupScreenshotImportGateway,
} from './WarmupScreenshotImportGateway.js';

export type PaperTestOperatorConsoleStatus =
  | 'CONSOLE_READY'
  | 'CONSOLE_NEEDS_REVIEW'
  | 'CONSOLE_BLOCKED';

export interface PaperTestOperatorConsoleConfig {
  readonly repository: PaperEntryLedgerRepositoryPort;
  readonly sessionId?: string;
  readonly repeatSessionId?: string;
  readonly operatorId?: string;
  readonly tableId?: string;
  readonly strategyName?: string;
  readonly bankrollLabel?: string;
  readonly plannedRounds?: number;
  readonly dataDir?: string;
}

export interface PaperTestOperatorConsoleCommandResult {
  readonly ok: true;
  readonly status: PaperTestOperatorConsoleStatus;
  readonly command: string;
  readonly message: string;
  readonly nextAction: string;
  readonly state: PaperTestOperatorConsoleState;
}

export interface PaperTestOperatorConsoleCommandFailure {
  readonly ok: false;
  readonly error: {
    readonly code: 'PAPER_TEST_OPERATOR_CONSOLE_ERROR';
    readonly message: string;
  };
}

export type PaperTestOperatorConsoleResult =
  | PaperTestOperatorConsoleCommandResult
  | PaperTestOperatorConsoleCommandFailure;

export interface PaperTestOperatorConsoleState {
  readonly sessionId: string;
  readonly repeatSessionId: string;
  readonly operatorId: string;
  readonly tableId: string;
  readonly strategyName: string;
  readonly bankrollLabel: string;
  readonly plannedRounds: number;
  readonly started: boolean;
  readonly warmupLoaded: boolean;
  readonly warmupQualified: boolean;
  readonly totalWarmupRounds: number;
  readonly liveRounds: readonly string[];
  readonly confirms: number;
  readonly rejects: number;
  readonly wins: number;
  readonly losses: number;
  readonly skips: number;
  readonly finished: boolean;
  readonly certified: boolean;
  readonly paperOnly: true;
  readonly liveMoneyAuthorization: false;
  readonly automaticExecutionAllowed: false;
  readonly automaticBetExecutionAllowed: false;
  readonly humanSupervisionRequired: true;
}

/**
 * Single operator console facade for PAPER_TEST_001.
 *
 * This class intentionally keeps all execution manual and supervised. It does
 * not place bets, does not click external platforms and does not authorize live
 * money. It only coordinates operator commands and audit-friendly state.
 */
export class PaperTestOperatorConsole {
  private readonly repository: PaperEntryLedgerRepositoryPort;
  private readonly starter: PaperTradingRepeatSessionStarter;
  private readonly closing: FirstPaperSessionClosingProtocol;
  private readonly certification: FirstCompletePaperSessionCertification;
  private readonly screenshotGateway: WarmupScreenshotImportGateway;
  private readonly dataDir: string;

  private state: PaperTestOperatorConsoleState;

  public constructor(config: PaperTestOperatorConsoleConfig) {
    this.repository = config.repository;
    this.starter = new PaperTradingRepeatSessionStarter(this.repository);
    this.closing = new FirstPaperSessionClosingProtocol(this.repository);
    this.certification = new FirstCompletePaperSessionCertification(this.repository);
    this.dataDir = config.dataDir || join(process.cwd(), 'data', 'paper-runtime');
    this.screenshotGateway = new WarmupScreenshotImportGateway({
      screenshotDir: join(this.dataDir, 'warmup-screenshots'),
      outputDir: this.dataDir,
      minimumRounds: 100,
    });

    this.state = Object.freeze({
      sessionId: config.sessionId || 'first-paper-session',
      repeatSessionId: config.repeatSessionId || 'PAPER_TEST_001',
      operatorId: config.operatorId || 'Thiago',
      tableId: config.tableId || 'mesa-real-observada-001',
      strategyName: config.strategyName || 'Triplicação',
      bankrollLabel: config.bankrollLabel || 'PAPER_BRL_70',
      plannedRounds: Number.isFinite(config.plannedRounds) ? Math.max(1, Number(config.plannedRounds)) : 200,
      started: false,
      warmupLoaded: false,
      warmupQualified: false,
      totalWarmupRounds: 0,
      liveRounds: Object.freeze([]),
      confirms: 0,
      rejects: 0,
      wins: 0,
      losses: 0,
      skips: 0,
      finished: false,
      certified: false,
      paperOnly: true as const,
      liveMoneyAuthorization: false as const,
      automaticExecutionAllowed: false as const,
      automaticBetExecutionAllowed: false as const,
      humanSupervisionRequired: true as const,
    });
  }

  public async execute(rawCommand: string, generatedAtEpochMs = Date.now()): Promise<PaperTestOperatorConsoleResult> {
    const parsed = this.parse(rawCommand);

    if (parsed.command.length === 0) {
      return this.success('help', this.helpText(), 'Digite start para iniciar PAPER_TEST_001.');
    }

    if (parsed.command === 'help') {
      return this.success('help', this.helpText(), this.nextAction());
    }

    if (parsed.command === 'status') {
      return this.success('status', this.statusText(), this.nextAction());
    }

    if (parsed.command === 'start') {
      return this.start(generatedAtEpochMs);
    }

    if (parsed.command === 'warmup' || parsed.command === 'warmup-latest') {
      return this.warmupLatest();
    }

    if (parsed.command === 'warmup-file') {
      return this.warmupFile(parsed.args.join(' '));
    }

    if (parsed.command === 'warmup-paste') {
      return this.warmupPaste(parsed.args.join(' '));
    }

    if (parsed.command === 'warmup-screenshot') {
      return this.warmupScreenshot(parsed.args[0] || 'latest');
    }

    if (parsed.command === 'qualify') {
      return this.qualify();
    }

    if (parsed.command === 'round') {
      return this.round(parsed.args[0] || '');
    }

    if (parsed.command === 'suggestion') {
      return this.suggestion();
    }

    if (parsed.command === 'confirm') {
      return this.confirm();
    }

    if (parsed.command === 'reject') {
      return this.reject();
    }

    if (parsed.command === 'win') {
      return this.win();
    }

    if (parsed.command === 'loss') {
      return this.loss();
    }

    if (parsed.command === 'skip') {
      return this.skip();
    }

    if (parsed.command === 'ledger') {
      return this.ledger();
    }

    if (parsed.command === 'finish') {
      return this.finish(generatedAtEpochMs);
    }

    if (parsed.command === 'certify') {
      return this.certify(generatedAtEpochMs);
    }

    if (parsed.command === 'exit') {
      return this.success('exit', 'Console finalizado pelo operador.', 'Feche o terminal se desejar.');
    }

    return this.failure(`Unknown console command: ${parsed.command}`);
  }

  public snapshot(): PaperTestOperatorConsoleState {
    return this.state;
  }

  private async start(generatedAtEpochMs: number): Promise<PaperTestOperatorConsoleResult> {
    const started = await this.starter.start({
      sessionId: 'first-paper-session',
      repeatSessionId: this.state.repeatSessionId,
      repeatSessionLabel: 'PAPER_TEST_001_REAL_TABLE_OBSERVED',
      operatorConfirmedLaunch: true,
      operatorConfirmedClose: true,
      operatorReady: true,
      realPlatformObserved: true,
      realMoneyBlocked: true,
      automaticExecutionBlocked: true,
      operatorId: this.state.operatorId,
      tableId: this.state.tableId,
      strategyName: this.state.strategyName,
      bankrollLabel: this.state.bankrollLabel,
      plannedRounds: this.state.plannedRounds,
      totalWins: 0,
      totalLosses: 0,
      totalSkips: 0,
    }, generatedAtEpochMs);

    if (!started.ok) {
      return this.failure(started.error.message);
    }

    if (started.value.status !== 'PAPER_REPEAT_READY') {
      return this.failure(`Repeat session starter returned ${started.value.status}`);
    }

    this.patch({ started: true });

    return this.success(
      'start',
      `PAPER_TEST_001 iniciado. Status=${started.value.status}. Dinheiro real bloqueado. Execução automática bloqueada.`,
      'Digite warmup para importar automaticamente o print mais recente sincronizado.',
    );
  }

  private warmupLatest(): PaperTestOperatorConsoleResult {
    const gemini = new WarmupGeminiExtractorIntegration().importLatest({
      repoRoot: process.cwd(),
      screenshotDir: join(this.dataDir, 'warmup-screenshots'),
      minRounds: 100,
    });

    if (gemini.ok && gemini.importedRoundsPath) {
      return this.warmupFile(gemini.importedRoundsPath);
    }

    return this.warmupScreenshot('latest');
  }

  private warmupFile(filePath: string): PaperTestOperatorConsoleResult {
    if (!this.state.started) {
      return this.failure('Start the console before importing warmup.');
    }

    const cleanPath = filePath.trim();

    if (cleanPath.length === 0) {
      return this.failure('warmup-file requires a file path.');
    }

    const payload = readFileSync(cleanPath, 'utf8');
    return this.ingestWarmup(payload, `file:${cleanPath}`);
  }

  private warmupPaste(payload: string): PaperTestOperatorConsoleResult {
    if (!this.state.started) {
      return this.failure('Start the console before pasting warmup.');
    }

    if (payload.trim().length === 0) {
      return this.failure('warmup-paste requires pasted rounds.');
    }

    return this.ingestWarmup(payload, 'paste');
  }

  private warmupScreenshot(screenshotPath: string): PaperTestOperatorConsoleResult {
    if (!this.state.started) {
      return this.failure('Start the console before importing warmup screenshot.');
    }

    const imported = this.screenshotGateway.import({
      screenshotPath: screenshotPath.trim().length > 0 ? screenshotPath.trim() : 'latest',
    });

    if (!imported.ok) {
      return this.failure(imported.error.message);
    }

    if (imported.value.status === 'WARMUP_SCREENSHOT_NEEDS_EXTRACTION') {
      return this.success(
        'warmup-screenshot',
        [
          'Print localizado, mas ainda precisa de extração Gemini.',
          `Screenshot: ${imported.value.screenshotPath}`,
          `Comando: ${imported.value.extractorCommand}`,
          'Depois rode novamente: warmup',
        ].join('\n'),
        'Rode o comando de extração Gemini e depois repita warmup.',
      );
    }

    if (imported.value.status === 'WARMUP_SCREENSHOT_BLOCKED') {
      return this.failure(imported.value.message);
    }

    if (imported.value.outputWarmupPath === null) {
      return this.failure('Warmup screenshot import did not generate output warmup file.');
    }

    return this.warmupFile(imported.value.outputWarmupPath);
  }

  private ingestWarmup(payload: string, source: string): PaperTestOperatorConsoleResult {
    const rounds = this.extractRounds(payload);

    if (rounds.length < 100) {
      return this.failure(`Warmup requires at least 100 valid rounds; received ${rounds.length}.`);
    }

    const outputPath = join(this.dataDir, 'paper-test-operator-console-warmup.json');
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, `${JSON.stringify({ source, rounds }, null, 2)}\n`, 'utf8');

    this.patch({
      warmupLoaded: true,
      warmupQualified: false,
      totalWarmupRounds: rounds.length,
    });

    return this.success(
      'warmup',
      `Warmup carregado com ${rounds.length} rodadas válidas. Fonte=${source}.`,
      'Digite qualify para qualificar o warmup.',
    );
  }

  private qualify(): PaperTestOperatorConsoleResult {

    const rawJsonPath = join(this.dataDir, 'warmup-screenshots', '.extracted.json');
    const profiler = new OcrCoverageProfiler();
    const rounds = this.loadWarmupRoundsFromDisk();
    
    const audit = profiler.evaluate(rawJsonPath, rounds.length);

    if (!audit.isApproved) {
      return this.failure(`[OCR AUDIT LOCK] Qualificação Abortada!
${audit.message}`);
    }

    if (!this.state.warmupLoaded) {
      return this.failure('Load warmup before qualification.');
    }

    const qualified = this.state.totalWarmupRounds >= 100;

    this.patch({ warmupQualified: qualified });

    return this.success(
      'qualify',
      qualified
        ? `Warmup qualificado para PAPER supervisionado. Rodadas=${this.state.totalWarmupRounds}.`
        : 'Warmup não qualificado.',
      qualified ? 'Digite round <número|P|V|0> para registrar rodadas ao vivo.' : 'Recarregue o warmup.',
    );
  }

  private round(value: string): PaperTestOperatorConsoleResult {
    if (!this.state.warmupQualified) {
      return this.failure('Qualify warmup before entering live rounds.');
    }

    const normalized = this.normalizeRound(value);

    if (normalized.length === 0) {
      return this.failure('round requires a valid value: 0-36, P, V, PRETO, VERMELHO.');
    }

    this.patch({
      liveRounds: Object.freeze([...this.state.liveRounds, normalized]),
    });

    return this.success(
      'round',
      `Rodada registrada: ${normalized}. Total ao vivo=${this.state.liveRounds.length}.`,
      'Digite suggestion para obter orientação PAPER supervisionada.',
    );
  }

  private suggestion(): PaperTestOperatorConsoleResult {
    if (!this.state.started) {
      return this.failure('Start the console before requesting suggestion.');
    }

    if (!this.state.warmupLoaded || !this.state.warmupQualified) {
      return this.failure('Warmup must be loaded and qualified before requesting suggestion.');
    }

    const decision = new AnalyticsDecisionEngine().evaluate({
      warmupRounds: this.loadWarmupRoundsFromDisk(),
      liveRounds: this.state.liveRounds,
      minimumLiveRounds: 6,
    });

    const separator = String.fromCharCode(10);
    const message = [
      `Recommendation: ${decision.recommendation}`,
      `Reason: ${decision.message}`,
      `Confidence: ${decision.confidence.toFixed(2)}`,
      `Risk: ${decision.risk.toFixed(2)}`,
      `Triplicacao: totalTrios=${decision.triplicacao.totalTrios} dominant=${decision.triplicacao.dominantPattern} ratio=${decision.triplicacao.dominantRatio.toFixed(2)} TC=${decision.triplicacao.tc} NTC=${decision.triplicacao.ntc} TA=${decision.triplicacao.ta} NTA=${decision.triplicacao.nta} zeroTrios=${decision.triplicacao.zeroTrios}`,
      `Heatmap: hot=${decision.heatmap.hotNumbers.join(',') || 'none'} cold=${decision.heatmap.coldNumbers.join(',') || 'none'} zeroFrequency=${decision.heatmap.zeroFrequency.toFixed(3)}`,
      `Consensus: ${decision.consensus.classification} engines=${decision.consensus.enginesAligned}/${decision.consensus.enginesTotal}`,
      `WarmupRounds: ${this.state.totalWarmupRounds}`,
      `LiveRounds: ${this.state.liveRounds.length}`,
      'LiveMoneyAuthorization: false',
      'AutomaticBetExecutionAllowed: false',
    ].join(separator);

    return this.success(
      'suggestion',
      message,
      decision.recommendation === 'PAPER_SINAL_FORTE' || decision.recommendation === 'PAPER_SINAL_FRACO'
        ? 'Avalie manualmente. Use confirm/reject somente em PAPER.'
        : 'Digite round <valor> para continuar observando.',
    );
  }

  private loadWarmupRoundsFromDisk(): readonly string[] {
    const candidates = [
      join(this.dataDir, 'warmup-screenshots', 'warmup-screenshot-imported-rounds.txt'),
      join(this.dataDir, 'warmup-rounds.txt'),
      join(this.dataDir, 'warmup.txt'),
    ];

    for (const candidate of candidates) {
      try {
        const payload = readFileSync(candidate, 'utf8');
        const rounds = payload
          .split(/[^0-9]+/u)
          .filter((part) => part.trim().length > 0);

        if (rounds.length > 0) return Object.freeze(rounds);
      } catch {
        // try next candidate
      }
    }

    return Object.freeze([]);
  }

  private confirm(): PaperTestOperatorConsoleResult {
    this.patch({ confirms: this.state.confirms + 1 });
    return this.success('confirm', 'Confirmação PAPER registrada. Nenhuma aposta real foi executada.', 'Depois registre win, loss ou skip.');
  }

  private reject(): PaperTestOperatorConsoleResult {
    this.patch({ rejects: this.state.rejects + 1 });
    return this.success('reject', 'Recusa PAPER registrada.', 'Continue com round <valor> ou suggestion.');
  }

  private win(): PaperTestOperatorConsoleResult {
    this.patch({ wins: this.state.wins + 1 });
    return this.success('win', 'WIN PAPER registrado.', 'Continue com round <valor> ou finish.');
  }

  private loss(): PaperTestOperatorConsoleResult {
    this.patch({ losses: this.state.losses + 1 });
    return this.success('loss', 'LOSS PAPER registrado.', 'Continue com round <valor> ou finish.');
  }

  private skip(): PaperTestOperatorConsoleResult {
    this.patch({ skips: this.state.skips + 1 });
    return this.success('skip', 'SKIP PAPER registrado.', 'Continue com round <valor> ou finish.');
  }

  private async ledger(): Promise<PaperTestOperatorConsoleResult> {
    const stats = await this.repository.stats();

    if (!stats.ok) {
      return this.failure(stats.error.message);
    }

    return this.success(
      'ledger',
      [
        `LedgerEntries: ${stats.value.totalEntries}`,
        `Authorized: ${stats.value.authorizedCount}`,
        `RejectedByOperator: ${stats.value.rejectedByOperatorCount}`,
        `DeniedByHud: ${stats.value.deniedByHudCount}`,
        `ConsoleWins: ${this.state.wins}`,
        `ConsoleLosses: ${this.state.losses}`,
        `ConsoleSkips: ${this.state.skips}`,
      ].join('\n'),
      this.nextAction(),
    );
  }

  private async finish(generatedAtEpochMs: number): Promise<PaperTestOperatorConsoleResult> {
    const closed = await this.closing.close({
      sessionId: this.state.repeatSessionId,
      operatorConfirmedClose: true,
      ledgerValidated: true,
      snapshotValidated: true,
      reportExported: true,
      auditExported: true,
      totalWins: this.state.wins,
      totalLosses: this.state.losses,
      totalSkips: this.state.skips,
      closingNotes: ['Closed from Paper Test Operator Console.'],
    }, generatedAtEpochMs);

    if (!closed.ok) {
      return this.failure(closed.error.message);
    }

    if (closed.value.status === 'SESSION_CLOSING_BLOCKED') {
      return this.failure('Closing protocol blocked the session.');
    }

    this.patch({ finished: true });

    return this.success(
      'finish',
      `Sessão finalizada. ClosingStatus=${closed.value.status}. CertificationCandidate=${closed.value.certificationCandidate}.`,
      'Digite certify para certificar a sessão PAPER.',
    );
  }

  private async certify(generatedAtEpochMs: number): Promise<PaperTestOperatorConsoleResult> {
    if (!this.state.finished) {
      return this.failure('Finish the session before certification.');
    }

    const certified = await this.certification.certify({
      sessionId: this.state.repeatSessionId,
      operatorConfirmedLaunch: true,
      operatorConfirmedClose: true,
      runtimePaperAvailable: true,
      snapshotPathAvailable: true,
      ledgerPathConfigured: true,
      operatorId: this.state.operatorId,
      tableId: this.state.tableId,
      strategyName: this.state.strategyName,
      bankrollLabel: this.state.bankrollLabel,
      plannedRounds: this.state.plannedRounds,
      snapshotValidated: true,
      ledgerValidated: true,
      reportExported: true,
      auditExported: true,
      totalWins: this.state.wins,
      totalLosses: this.state.losses,
      totalSkips: this.state.skips,
      closingNotes: ['Certified from Paper Test Operator Console.'],
    }, generatedAtEpochMs);

    if (!certified.ok) {
      return this.failure(certified.error.message);
    }

    this.patch({ certified: true });

    return this.success(
      'certify',
      `CertificationStatus=${certified.value.status}. Score=${certified.value.certificationScorePercent}.`,
      'PAPER_TEST_001 concluído. Digite exit.',
    );
  }

  private helpText(): string {
    return [
      'Commands:',
      '  help',
      '  start',
      '  warmup',
      '  warmup-latest',
      '  warmup-file <arquivo>',
      '  warmup-paste <rodadas separadas por vírgula/espaço>',
      '  warmup-screenshot latest',
      '  qualify',
      '  round <0-36|P|V|PRETO|VERMELHO>',
      '  suggestion',
      '  confirm',
      '  reject',
      '  win',
      '  loss',
      '  skip',
      '  ledger',
      '  status',
      '  finish',
      '  certify',
      '  exit',
      '',
      'Governance:',
      '  PaperOnly=true',
      '  LiveMoneyAuthorization=false',
      '  AutomaticExecutionAllowed=false',
      '  AutomaticBetExecutionAllowed=false',
      '  HumanSupervisionRequired=true',
    ].join('\n');
  }

  private statusText(): string {
    return [
      `SessionId: ${this.state.sessionId}`,
      `RepeatSessionId: ${this.state.repeatSessionId}`,
      `Started: ${this.state.started}`,
      `WarmupLoaded: ${this.state.warmupLoaded}`,
      `WarmupQualified: ${this.state.warmupQualified}`,
      `WarmupRounds: ${this.state.totalWarmupRounds}`,
      `LiveRounds: ${this.state.liveRounds.length}`,
      `Confirms: ${this.state.confirms}`,
      `Rejects: ${this.state.rejects}`,
      `Wins: ${this.state.wins}`,
      `Losses: ${this.state.losses}`,
      `Skips: ${this.state.skips}`,
      `Finished: ${this.state.finished}`,
      `Certified: ${this.state.certified}`,
      'LiveMoneyAuthorization: false',
      'AutomaticBetExecutionAllowed: false',
    ].join('\n');
  }

  private nextAction(): string {
    if (!this.state.started) return 'Digite start.';
    if (!this.state.warmupLoaded) return 'Digite warmup para importar automaticamente o print mais recente sincronizado.';
    if (!this.state.warmupQualified) return 'Digite qualify.';
    if (!this.state.finished) return 'Digite round <valor>, suggestion, win/loss/skip, ledger ou finish.';
    if (!this.state.certified) return 'Digite certify.';
    return 'Digite exit.';
  }

  private success(command: string, message: string, nextAction: string): PaperTestOperatorConsoleCommandResult {
    return Object.freeze({
      ok: true as const,
      status: this.consoleStatus(),
      command,
      message,
      nextAction,
      state: this.state,
    });
  }

  private failure(message: string): PaperTestOperatorConsoleCommandFailure {
    return {
      ok: false,
      error: {
        code: 'PAPER_TEST_OPERATOR_CONSOLE_ERROR',
        message,
      },
    };
  }

  private consoleStatus(): PaperTestOperatorConsoleStatus {
    if (!this.state.started) return 'CONSOLE_READY';
    if (this.state.started && !this.state.warmupQualified) return 'CONSOLE_NEEDS_REVIEW';
    return 'CONSOLE_READY';
  }

  private patch(partial: Partial<PaperTestOperatorConsoleState>): void {
    this.state = Object.freeze({
      ...this.state,
      ...partial,
      paperOnly: true as const,
      liveMoneyAuthorization: false as const,
      automaticExecutionAllowed: false as const,
      automaticBetExecutionAllowed: false as const,
      humanSupervisionRequired: true as const,
    });
  }

  private parse(rawCommand: string): { readonly command: string; readonly args: readonly string[] } {
    const trimmed = rawCommand.trim();

    if (trimmed.length === 0) {
      return { command: '', args: Object.freeze([]) };
    }

    const [command, ...args] = trimmed.split(/\s+/);
    return {
      command: command.toLowerCase(),
      args: Object.freeze(args),
    };
  }

  private extractRounds(payload: string): readonly string[] {
    return Object.freeze(
      payload
        .split(/[\s,;|\n\r\t]+/)
        .map((token) => this.normalizeRound(token))
        .filter((token) => token.length > 0),
    );
  }

  private normalizeRound(value: string): string {
    const token = String(value || '').trim().toUpperCase();

    if (token === 'P' || token === 'PRETO' || token === 'BLACK') return 'P';
    if (token === 'V' || token === 'VERMELHO' || token === 'RED') return 'V';
    if (token === '0' || token === 'ZERO') return '0';

    const asNumber = Number(token);

    if (Number.isInteger(asNumber) && asNumber >= 0 && asNumber <= 36) {
      return String(asNumber);
    }

    return '';
  }
}
