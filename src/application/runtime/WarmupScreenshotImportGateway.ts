import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join } from 'node:path';

export type WarmupScreenshotImportGatewayStatus =
  | 'WARMUP_SCREENSHOT_IMPORTED'
  | 'WARMUP_SCREENSHOT_NEEDS_EXTRACTION'
  | 'WARMUP_SCREENSHOT_BLOCKED';

export interface WarmupScreenshotImportGatewayConfig {
  readonly screenshotDir?: string;
  readonly outputDir?: string;
  readonly minimumRounds?: number;
}

export interface WarmupScreenshotImportGatewayInput {
  readonly screenshotPath?: string;
  readonly extractedJsonPath?: string;
  readonly extractedPayload?: string;
}

export interface WarmupScreenshotImportGatewayReport {
  readonly status: WarmupScreenshotImportGatewayStatus;
  readonly screenshotPath: string | null;
  readonly extractedRounds: readonly string[];
  readonly acceptedRounds: number;
  readonly zeroCount: number;
  readonly redCount: number;
  readonly blackCount: number;
  readonly numberCount: number;
  readonly outputWarmupPath: string | null;
  readonly outputReportPath: string;
  readonly extractionRequired: boolean;
  readonly extractorCommand: string | null;
  readonly message: string;
  readonly paperOnly: true;
  readonly liveMoneyAuthorization: false;
  readonly automaticExecutionAllowed: false;
  readonly automaticBetExecutionAllowed: false;
  readonly humanSupervisionRequired: true;
}

export interface WarmupScreenshotImportGatewaySuccess {
  readonly ok: true;
  readonly value: WarmupScreenshotImportGatewayReport;
}

export interface WarmupScreenshotImportGatewayFailure {
  readonly ok: false;
  readonly error: {
    readonly code: 'WARMUP_SCREENSHOT_IMPORT_GATEWAY_ERROR';
    readonly message: string;
  };
}

export type WarmupScreenshotImportGatewayResult =
  | WarmupScreenshotImportGatewaySuccess
  | WarmupScreenshotImportGatewayFailure;

/**
 * Imports roulette warmup from screenshot extraction output.
 *
 * The gateway does not decide entries, does not authorize live money and does
 * not execute bets. It only finds screenshots, accepts Gemini extraction JSON,
 * normalizes rounds and writes a warmup file for the operator console.
 */
export class WarmupScreenshotImportGateway {
  private readonly screenshotDir: string;
  private readonly outputDir: string;
  private readonly minimumRounds: number;

  public constructor(config: WarmupScreenshotImportGatewayConfig = {}) {
    this.screenshotDir = config.screenshotDir || join(process.cwd(), 'data', 'paper-runtime', 'warmup-screenshots');
    this.outputDir = config.outputDir || join(process.cwd(), 'data', 'paper-runtime');
    this.minimumRounds = Number.isFinite(config.minimumRounds) ? Math.max(1, Number(config.minimumRounds)) : 100;
  }

  public import(input: WarmupScreenshotImportGatewayInput = {}): WarmupScreenshotImportGatewayResult {
    const screenshotPath = this.resolveScreenshotPath(input.screenshotPath);
    const payload = this.resolvePayload(input);

    if (payload === null) {
      return this.needsExtraction(screenshotPath);
    }

    const rounds = this.extractRounds(payload);

    if (rounds.length < this.minimumRounds) {
      return this.blocked(
        screenshotPath,
        rounds,
        `Extração insuficiente: mínimo ${this.minimumRounds}, recebido ${rounds.length}.`,
      );
    }

    const report = this.persistReport({
      status: 'WARMUP_SCREENSHOT_IMPORTED',
      screenshotPath,
      rounds,
      extractionRequired: false,
      message: `Warmup importado com ${rounds.length} rodadas extraídas do screenshot.`,
    });

    return {
      ok: true,
      value: report,
    };
  }

  public latestScreenshot(): string | null {
    if (!existsSync(this.screenshotDir)) {
      return null;
    }

    const candidates = readdirSync(this.screenshotDir)
      .map((name) => join(this.screenshotDir, name))
      .filter((filePath) => this.isImage(filePath))
      .filter((filePath) => statSync(filePath).isFile())
      .sort((left, right) => statSync(right).mtimeMs - statSync(left).mtimeMs);

    return candidates[0] || null;
  }

  private resolveScreenshotPath(inputPath: string | undefined): string | null {
    if (typeof inputPath === 'string' && inputPath.trim().length > 0 && inputPath.trim() !== 'latest') {
      return inputPath.trim();
    }

    return this.latestScreenshot();
  }

  private resolvePayload(input: WarmupScreenshotImportGatewayInput): string | null {
    if (typeof input.extractedPayload === 'string' && input.extractedPayload.trim().length > 0) {
      return input.extractedPayload;
    }

    if (typeof input.extractedJsonPath === 'string' && input.extractedJsonPath.trim().length > 0) {
      return readFileSync(input.extractedJsonPath.trim(), 'utf8');
    }

    const screenshotPath = this.resolveScreenshotPath(input.screenshotPath);

    if (screenshotPath !== null) {
      const sidecar = this.sidecarPath(screenshotPath);

      if (existsSync(sidecar)) {
        return readFileSync(sidecar, 'utf8');
      }
    }

    return null;
  }

  private needsExtraction(screenshotPath: string | null): WarmupScreenshotImportGatewayResult {
    if (screenshotPath === null) {
      return this.blocked(null, [], 'Nenhum screenshot encontrado na pasta de warmup.');
    }

    const report = this.persistReport({
      status: 'WARMUP_SCREENSHOT_NEEDS_EXTRACTION',
      screenshotPath,
      rounds: [],
      extractionRequired: true,
      message: 'Screenshot localizado, mas ainda não existe JSON extraído. Rode o extrator Gemini.',
    });

    return {
      ok: true,
      value: report,
    };
  }

  private blocked(
    screenshotPath: string | null,
    rounds: readonly string[],
    message: string,
  ): WarmupScreenshotImportGatewayResult {
    const report = this.persistReport({
      status: 'WARMUP_SCREENSHOT_BLOCKED',
      screenshotPath,
      rounds,
      extractionRequired: screenshotPath !== null,
      message,
    });

    return {
      ok: true,
      value: report,
    };
  }

  private persistReport(input: {
    readonly status: WarmupScreenshotImportGatewayStatus;
    readonly screenshotPath: string | null;
    readonly rounds: readonly string[];
    readonly extractionRequired: boolean;
    readonly message: string;
  }): WarmupScreenshotImportGatewayReport {
    mkdirSync(this.outputDir, { recursive: true });

    const outputWarmupPath = input.status === 'WARMUP_SCREENSHOT_IMPORTED'
      ? join(this.outputDir, 'warmup-screenshot-imported-rounds.txt')
      : null;
    const outputReportPath = join(this.outputDir, 'warmup-screenshot-import-report.json');
    const extractorCommand = input.screenshotPath === null
      ? null
      : `python3 scripts/extrator_gemini.py "${input.screenshotPath}" "${this.sidecarPath(input.screenshotPath)}"`;

    if (outputWarmupPath !== null) {
      writeFileSync(outputWarmupPath, `${input.rounds.join(',')}\n`, 'utf8');
    }

    const report: WarmupScreenshotImportGatewayReport = Object.freeze({
      status: input.status,
      screenshotPath: input.screenshotPath,
      extractedRounds: Object.freeze(input.rounds),
      acceptedRounds: input.rounds.length,
      zeroCount: input.rounds.filter((round) => round === '0').length,
      redCount: input.rounds.filter((round) => round === 'V').length,
      blackCount: input.rounds.filter((round) => round === 'P').length,
      numberCount: input.rounds.filter((round) => /^\d+$/.test(round)).length,
      outputWarmupPath,
      outputReportPath,
      extractionRequired: input.extractionRequired,
      extractorCommand,
      message: input.message,
      paperOnly: true as const,
      liveMoneyAuthorization: false as const,
      automaticExecutionAllowed: false as const,
      automaticBetExecutionAllowed: false as const,
      humanSupervisionRequired: true as const,
    });

    writeFileSync(outputReportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

    return report;
  }

  private extractRounds(payload: string): readonly string[] {
    const parsed = this.tryJson(payload);

    if (parsed !== null) {
      const candidate = this.roundArrayFromJson(parsed);

      if (candidate.length > 0) {
        return Object.freeze(candidate.map((value) => this.normalizeRound(value)).filter((value) => value.length > 0));
      }
    }

    return Object.freeze(
      payload
        .split(/[\s,;|\n\r\t]+/)
        .map((token) => this.normalizeRound(token))
        .filter((token) => token.length > 0),
    );
  }

  private tryJson(payload: string): unknown | null {
    try {
      return JSON.parse(payload);
    } catch {
      return null;
    }
  }

  private roundArrayFromJson(parsed: unknown): readonly unknown[] {
    if (Array.isArray(parsed)) {
      return parsed;
    }

    if (typeof parsed === 'object' && parsed !== null) {
      const record = parsed as {
        readonly rounds?: unknown;
        readonly numeros?: unknown;
        readonly numbers?: unknown;
        readonly resultados?: unknown;
        readonly results?: unknown;
      };

      if (Array.isArray(record.rounds)) return record.rounds;
      if (Array.isArray(record.numeros)) return record.numeros;
      if (Array.isArray(record.numbers)) return record.numbers;
      if (Array.isArray(record.resultados)) return record.resultados;
      if (Array.isArray(record.results)) return record.results;
    }

    return Object.freeze([]);
  }

  private normalizeRound(value: unknown): string {
    const token = String(value ?? '').trim().toUpperCase();

    if (token === 'P' || token === 'PRETO' || token === 'BLACK') return 'P';
    if (token === 'V' || token === 'VERMELHO' || token === 'RED') return 'V';
    if (token === '0' || token === 'ZERO') return '0';

    const asNumber = Number(token);

    if (Number.isInteger(asNumber) && asNumber >= 0 && asNumber <= 36) {
      return String(asNumber);
    }

    return '';
  }

  private isImage(filePath: string): boolean {
    return ['.png', '.jpg', '.jpeg', '.webp'].includes(extname(filePath).toLowerCase());
  }

  private sidecarPath(screenshotPath: string): string {
    return join(dirname(screenshotPath), `${basename(screenshotPath, extname(screenshotPath))}.extracted.json`);
  }
}
