import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join } from 'node:path';
import { spawnSync } from 'node:child_process';

export interface WarmupGeminiExtractorResult {
  readonly ok: boolean;
  readonly status:
    | 'IMPORTED_FROM_SIDECAR'
    | 'EXTRACTED_BY_GEMINI'
    | 'NO_IMAGE_FOUND'
    | 'EXTRATOR_GEMINI_NOT_FOUND'
    | 'EXTRATOR_GEMINI_FAILED'
    | 'ROUNDS_INSUFFICIENT';
  readonly imagePath: string | null;
  readonly extractorPath: string | null;
  readonly sidecarPath: string | null;
  readonly importedRoundsPath: string | null;
  readonly roundCount: number;
  readonly message: string;
  readonly paperOnly: true;
  readonly liveMoneyAuthorized: false;
  readonly automaticBetExecutionAllowed: false;
}

export interface WarmupGeminiExtractorOptions {
  readonly repoRoot: string;
  readonly screenshotDir: string;
  readonly minRounds?: number;
  readonly extractorPath?: string;
}

interface RoundsPayload {
  readonly rounds?: readonly unknown[];
}

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const DEFAULT_MIN_ROUNDS = 100;

export class WarmupGeminiExtractorIntegration {
  public importLatest(options: WarmupGeminiExtractorOptions): WarmupGeminiExtractorResult {
    const minRounds = this.positiveIntegerOrDefault(options.minRounds, DEFAULT_MIN_ROUNDS);

    if (!existsSync(options.screenshotDir)) mkdirSync(options.screenshotDir, { recursive: true });

    const imagePath = this.latestImage(options.screenshotDir);
    if (!imagePath) {
      return this.result({
        ok: false,
        status: 'NO_IMAGE_FOUND',
        imagePath: null,
        extractorPath: null,
        sidecarPath: null,
        importedRoundsPath: null,
        roundCount: 0,
        message: `Nenhum print encontrado em ${options.screenshotDir}. Rode sync-warmup.sh primeiro.`,
      });
    }

    const sidecarPath = this.sidecarPath(imagePath);
    const importedRoundsPath = join(options.screenshotDir, 'warmup-screenshot-imported-rounds.txt');

    if (existsSync(sidecarPath)) {
      const rounds = this.readRounds(sidecarPath);
      this.writeRounds(importedRoundsPath, rounds);

      return this.result({
        ok: rounds.length >= minRounds,
        status: rounds.length >= minRounds ? 'IMPORTED_FROM_SIDECAR' : 'ROUNDS_INSUFFICIENT',
        imagePath,
        extractorPath: null,
        sidecarPath,
        importedRoundsPath,
        roundCount: rounds.length,
        message: rounds.length >= minRounds
          ? `Warmup importado do sidecar existente. Imagem=${basename(imagePath)} Rodadas=${rounds.length}`
          : `Sidecar encontrado, mas com rodadas insuficientes. Rodadas=${rounds.length} Mínimo=${minRounds}`,
      });
    }

    const extractorPath = options.extractorPath ?? this.findExtractor(options.repoRoot);

    if (!extractorPath) {
      return this.result({
        ok: false,
        status: 'EXTRATOR_GEMINI_NOT_FOUND',
        imagePath,
        extractorPath: null,
        sidecarPath,
        importedRoundsPath,
        roundCount: 0,
        message: 'scripts/extrator_gemini.py não localizado.',
      });
    }

    return this.runGeminiExtractor({
      extractorPath,
      imagePath,
      sidecarPath,
      importedRoundsPath,
      minRounds,
    });
  }

  private runGeminiExtractor(input: {
    readonly extractorPath: string;
    readonly imagePath: string;
    readonly sidecarPath: string;
    readonly importedRoundsPath: string;
    readonly minRounds: number;
  }): WarmupGeminiExtractorResult {
    const proc = spawnSync('python3', [input.extractorPath, input.imagePath, input.sidecarPath], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const rounds = this.collectRounds(input.sidecarPath, input.importedRoundsPath, proc.stdout);

    if (proc.status === 0 && rounds.length > 0) {
      this.writeSidecar(input.sidecarPath, rounds);
      this.writeRounds(input.importedRoundsPath, rounds);

      return this.result({
        ok: rounds.length >= input.minRounds,
        status: rounds.length >= input.minRounds ? 'EXTRACTED_BY_GEMINI' : 'ROUNDS_INSUFFICIENT',
        imagePath: input.imagePath,
        extractorPath: input.extractorPath,
        sidecarPath: input.sidecarPath,
        importedRoundsPath: input.importedRoundsPath,
        roundCount: rounds.length,
        message: `Warmup extraído pelo scripts/extrator_gemini.py. Rodadas=${rounds.length}`,
      });
    }

    writeFileSync(join(dirname(input.imagePath), 'warmup-gemini-extraction-failure.txt'), [
      'RL.SYS CORE — GEMINI EXTRACTION FAILURE',
      `image=${input.imagePath}`,
      `sidecar=${input.sidecarPath}`,
      `exit=${proc.status}`,
      `stdout=${proc.stdout || ''}`,
      `stderr=${proc.stderr || ''}`,
    ].join('\n'), 'utf8');

    return this.result({
      ok: false,
      status: 'EXTRATOR_GEMINI_FAILED',
      imagePath: input.imagePath,
      extractorPath: input.extractorPath,
      sidecarPath: input.sidecarPath,
      importedRoundsPath: input.importedRoundsPath,
      roundCount: 0,
      message: 'scripts/extrator_gemini.py falhou. Verifique warmup-gemini-extraction-failure.txt.',
    });
  }

  private collectRounds(sidecarPath: string, importedPath: string, stdout: string): readonly number[] {
    if (existsSync(sidecarPath)) {
      const rounds = this.readRounds(sidecarPath);
      if (rounds.length > 0) return rounds;
    }

    if (existsSync(importedPath)) {
      const rounds = this.parseRounds(readFileSync(importedPath, 'utf8'));
      if (rounds.length > 0) return rounds;
    }

    return this.parseRoundsFromText(stdout);
  }

  private parseRoundsFromText(text: string): readonly number[] {
    const trimmed = text.trim();
    if (!trimmed) return Object.freeze([]);

    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return this.normalize(parsed);
      if (this.isRoundsPayload(parsed)) return this.normalize(parsed.rounds ?? []);
    } catch {
      return this.parseRounds(trimmed);
    }

    return Object.freeze([]);
  }

  private parseRounds(text: string): readonly number[] {
    return Object.freeze(
      text
        .split(/[^0-9]+/u)
        .filter((part) => part.trim().length > 0)
        .map((part) => Number(part))
        .filter((value) => Number.isInteger(value) && value >= 0 && value <= 36),
    );
  }

  private readRounds(path: string): readonly number[] {
    const raw = readFileSync(path, 'utf8');

    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) return this.normalize(parsed);
      if (this.isRoundsPayload(parsed)) return this.normalize(parsed.rounds ?? []);
    } catch {
      return this.parseRounds(raw);
    }

    return Object.freeze([]);
  }

  private isRoundsPayload(value: unknown): value is RoundsPayload {
    return typeof value === 'object' && value !== null && 'rounds' in value;
  }

  private normalize(values: readonly unknown[]): readonly number[] {
    const output: number[] = [];

    for (const value of values) {
      if (typeof value === 'number') {
        if (Number.isInteger(value) && value >= 0 && value <= 36) output.push(value);
        continue;
      }

      if (typeof value === 'string') {
        output.push(...this.parseRounds(value));
        continue;
      }

      const stringValue = String(value).trim();
      if (stringValue.length === 0) continue;

      const numeric = Number(stringValue);
      if (Number.isInteger(numeric) && numeric >= 0 && numeric <= 36) output.push(numeric);
    }

    return Object.freeze(output);
  }

  private writeSidecar(path: string, rounds: readonly number[]): void {
    writeFileSync(path, `${JSON.stringify({ rounds }, null, 2)}\n`, 'utf8');
  }

  private writeRounds(path: string, rounds: readonly number[]): void {
    writeFileSync(path, rounds.join(','), 'utf8');
  }

  private latestImage(dir: string): string | null {
    const images = readdirSync(dir)
      .filter((entry) => IMAGE_EXTENSIONS.has(extname(entry).toLowerCase()))
      .map((entry) => join(dir, entry))
      .filter((path) => statSync(path).isFile())
      .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);

    return images[0] ?? null;
  }

  private sidecarPath(imagePath: string): string {
    return join(dirname(imagePath), `${basename(imagePath, extname(imagePath))}.extracted.json`);
  }

  private findExtractor(repoRoot: string): string | null {
    const envPath = process.env.RLSYS_GEMINI_EXTRACTOR_PATH;
    if (envPath && existsSync(envPath)) return envPath;

    const candidates = [
      join(repoRoot, 'scripts', 'extrator_gemini.py'),
      join(repoRoot, 'extrator_gemini.py'),
    ];

    for (const candidate of candidates) {
      if (existsSync(candidate)) return candidate;
    }

    return null;
  }

  private result(input: Omit<WarmupGeminiExtractorResult, 'paperOnly' | 'liveMoneyAuthorized' | 'automaticBetExecutionAllowed'>): WarmupGeminiExtractorResult {
    return Object.freeze({
      ...input,
      paperOnly: true,
      liveMoneyAuthorized: false,
      automaticBetExecutionAllowed: false,
    });
  }

  private positiveIntegerOrDefault(value: number | undefined, fallback: number): number {
    return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : fallback;
  }
}
