import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export type InstitutionalMemoryRepositoryReason =
  | 'INSTITUTIONAL_MEMORY_REPOSITORY_OK'
  | 'INVALID_INSTITUTIONAL_MEMORY_INPUT'
  | 'INSTITUTIONAL_MEMORY_IO_ERROR'
  | 'LIVE_MONEY_FORBIDDEN';

export interface InstitutionalMemorySessionRecord {
  readonly sessionId: string;
  readonly tableId: string;
  readonly strategyId: string;
  readonly startedAtEpochMs: number;
  readonly finishedAtEpochMs: number;
  readonly roundCount: number;
  readonly finalStatus: string;
  readonly finalConfidence: number;
  readonly suggestionCount: number;
  readonly favorableSuggestionCount: number;
  readonly operatorStatus: string;
  readonly consensusDecision: string;
  readonly strategyReputation: string;
  readonly tableReputation: string;
  readonly notes: readonly string[];
  readonly productionMoneyAllowed?: boolean;
  readonly liveMoneyAuthorization?: boolean;
}

export interface InstitutionalMemoryIndexRecord {
  readonly key: string;
  readonly updatedAtEpochMs: number;
  readonly sampleSize: number;
  readonly score: number;
  readonly suggestedWeight: number;
  readonly decision: string;
  readonly productionMoneyAllowed?: boolean;
  readonly liveMoneyAuthorization?: boolean;
}

export interface InstitutionalMemoryRepositoryPaths {
  readonly rootDir: string;
  readonly sessionsDir: string;
  readonly indexDir: string;
  readonly memoryDir: string;
  readonly journalPath: string;
}

export interface InstitutionalMemoryRepositoryConfig {
  readonly rootDir: string;
  readonly maxSessionFileBytes: number;
  readonly productionMoneyAllowed?: boolean;
  readonly liveMoneyAuthorization?: boolean;
}

export type InstitutionalMemoryRepositoryResult<T> =
  | {
      readonly ok: true;
      readonly value: T;
      readonly productionMoneyAllowed: false;
      readonly liveMoneyAuthorization: false;
    }
  | {
      readonly ok: false;
      readonly error: {
        readonly reason: InstitutionalMemoryRepositoryReason;
        readonly message: string;
        readonly productionMoneyAllowed: false;
        readonly liveMoneyAuthorization: false;
      };
    };

/**
 * InstitutionalMemoryRepository
 *
 * Repositório local leve para o laboratório institucional:
 * - data/laboratory/sessions/*.json
 * - data/laboratory/index/*.json
 * - data/laboratory/memory/session-journal.jsonl
 *
 * Não usa banco pesado, não altera sessão ativa e não autoriza live money.
 * A persistência é idempotente por sessionId e adequada ao Termux/A10s.
 */
export class InstitutionalMemoryRepository {
  private readonly paths: InstitutionalMemoryRepositoryPaths;
  private readonly maxSessionFileBytes: number;

  public constructor(config: InstitutionalMemoryRepositoryConfig) {
    this.paths = {
      rootDir: config.rootDir,
      sessionsDir: path.join(config.rootDir, 'sessions'),
      indexDir: path.join(config.rootDir, 'index'),
      memoryDir: path.join(config.rootDir, 'memory'),
      journalPath: path.join(config.rootDir, 'memory', 'session-journal.jsonl'),
    };
    this.maxSessionFileBytes = config.maxSessionFileBytes;
  }

  public getPaths(): InstitutionalMemoryRepositoryPaths {
    return this.paths;
  }

  public async ensureLayout(): Promise<InstitutionalMemoryRepositoryResult<InstitutionalMemoryRepositoryPaths>> {
    try {
      await fs.mkdir(this.paths.sessionsDir, { recursive: true });
      await fs.mkdir(this.paths.indexDir, { recursive: true });
      await fs.mkdir(this.paths.memoryDir, { recursive: true });

      return this.ok(this.paths);
    } catch (error) {
      return this.ioError(error);
    }
  }

  public async saveSession(
    record: InstitutionalMemorySessionRecord,
  ): Promise<InstitutionalMemoryRepositoryResult<InstitutionalMemorySessionRecord>> {
    const liveMoneyViolation = this.hasLiveMoneyViolation(record);

    if (liveMoneyViolation !== null) {
      return this.fail('LIVE_MONEY_FORBIDDEN', liveMoneyViolation);
    }

    const invalidReason = this.validateSession(record);

    if (invalidReason !== null) {
      return this.fail('INVALID_INSTITUTIONAL_MEMORY_INPUT', invalidReason);
    }

    try {
      await this.ensureLayout();

      const payload = `${JSON.stringify({
        ...record,
        productionMoneyAllowed: false,
        liveMoneyAuthorization: false,
      }, null, 2)}\n`;

      if (Buffer.byteLength(payload, 'utf8') > this.maxSessionFileBytes) {
        return this.fail('INVALID_INSTITUTIONAL_MEMORY_INPUT', 'session record exceeds maxSessionFileBytes.');
      }

      const filePath = path.join(this.paths.sessionsDir, `${record.sessionId}.json`);
      const tempPath = `${filePath}.tmp`;

      await fs.writeFile(tempPath, payload, 'utf8');
      await fs.rename(tempPath, filePath);

      await fs.appendFile(
        this.paths.journalPath,
        `${JSON.stringify({
          type: 'SESSION_SAVED',
          sessionId: record.sessionId,
          tableId: record.tableId,
          strategyId: record.strategyId,
          finishedAtEpochMs: record.finishedAtEpochMs,
          productionMoneyAllowed: false,
          liveMoneyAuthorization: false,
        })}\n`,
        'utf8',
      );

      return this.ok({
        ...record,
        productionMoneyAllowed: false,
        liveMoneyAuthorization: false,
      });
    } catch (error) {
      return this.ioError(error);
    }
  }

  public async loadSession(
    sessionId: string,
  ): Promise<InstitutionalMemoryRepositoryResult<InstitutionalMemorySessionRecord>> {
    if (!this.isSafeToken(sessionId, 3, 96)) {
      return this.fail('INVALID_INSTITUTIONAL_MEMORY_INPUT', 'sessionId must be a safe token with 3 to 96 characters.');
    }

    try {
      const filePath = path.join(this.paths.sessionsDir, `${sessionId}.json`);
      const raw = await fs.readFile(filePath, 'utf8');
      const parsed = this.parseJsonObject(raw);

      if (parsed === null) {
        return this.fail('INVALID_INSTITUTIONAL_MEMORY_INPUT', 'stored session is not valid JSON object.');
      }

      const record = this.toSessionRecord(parsed);

      if (record === null) {
        return this.fail('INVALID_INSTITUTIONAL_MEMORY_INPUT', 'stored session shape is invalid.');
      }

      return this.ok(record);
    } catch (error) {
      return this.ioError(error);
    }
  }

  public async listSessionIds(): Promise<InstitutionalMemoryRepositoryResult<readonly string[]>> {
    try {
      await this.ensureLayout();

      const entries = await fs.readdir(this.paths.sessionsDir, { withFileTypes: true });
      const ids: string[] = [];

      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.json') && !entry.name.endsWith('.tmp')) {
          ids.push(entry.name.slice(0, -5));
        }
      }

      ids.sort();

      return this.ok(ids);
    } catch (error) {
      return this.ioError(error);
    }
  }

  public async saveIndex(
    indexName: string,
    record: InstitutionalMemoryIndexRecord,
  ): Promise<InstitutionalMemoryRepositoryResult<InstitutionalMemoryIndexRecord>> {
    if (!this.isSafeToken(indexName, 3, 96)) {
      return this.fail('INVALID_INSTITUTIONAL_MEMORY_INPUT', 'indexName must be a safe token with 3 to 96 characters.');
    }

    const liveMoneyViolation = this.hasLiveMoneyViolation(record);

    if (liveMoneyViolation !== null) {
      return this.fail('LIVE_MONEY_FORBIDDEN', liveMoneyViolation);
    }

    const invalidReason = this.validateIndex(record);

    if (invalidReason !== null) {
      return this.fail('INVALID_INSTITUTIONAL_MEMORY_INPUT', invalidReason);
    }

    try {
      await this.ensureLayout();

      const payload = `${JSON.stringify({
        ...record,
        productionMoneyAllowed: false,
        liveMoneyAuthorization: false,
      }, null, 2)}\n`;

      const filePath = path.join(this.paths.indexDir, `${indexName}.json`);
      const tempPath = `${filePath}.tmp`;

      await fs.writeFile(tempPath, payload, 'utf8');
      await fs.rename(tempPath, filePath);

      return this.ok({
        ...record,
        productionMoneyAllowed: false,
        liveMoneyAuthorization: false,
      });
    } catch (error) {
      return this.ioError(error);
    }
  }

  public async loadIndex(
    indexName: string,
  ): Promise<InstitutionalMemoryRepositoryResult<InstitutionalMemoryIndexRecord>> {
    if (!this.isSafeToken(indexName, 3, 96)) {
      return this.fail('INVALID_INSTITUTIONAL_MEMORY_INPUT', 'indexName must be a safe token with 3 to 96 characters.');
    }

    try {
      const filePath = path.join(this.paths.indexDir, `${indexName}.json`);
      const raw = await fs.readFile(filePath, 'utf8');
      const parsed = this.parseJsonObject(raw);

      if (parsed === null) {
        return this.fail('INVALID_INSTITUTIONAL_MEMORY_INPUT', 'stored index is not valid JSON object.');
      }

      const record = this.toIndexRecord(parsed);

      if (record === null) {
        return this.fail('INVALID_INSTITUTIONAL_MEMORY_INPUT', 'stored index shape is invalid.');
      }

      return this.ok(record);
    } catch (error) {
      return this.ioError(error);
    }
  }

  private validateSession(record: InstitutionalMemorySessionRecord): string | null {
    if (!this.isSafeToken(record.sessionId, 3, 96)) return 'sessionId must be a safe token.';
    if (!this.isSafeToken(record.tableId, 3, 96)) return 'tableId must be a safe token.';
    if (!this.isSafeToken(record.strategyId, 3, 96)) return 'strategyId must be a safe token.';

    if (!Number.isInteger(record.startedAtEpochMs) || record.startedAtEpochMs <= 0) return 'startedAtEpochMs must be positive integer.';
    if (!Number.isInteger(record.finishedAtEpochMs) || record.finishedAtEpochMs < record.startedAtEpochMs) return 'finishedAtEpochMs must be >= startedAtEpochMs.';
    if (!Number.isInteger(record.roundCount) || record.roundCount < 0 || record.roundCount > 10000) return 'roundCount must be between 0 and 10000.';
    if (!this.isMeaningful(record.finalStatus)) return 'finalStatus must be meaningful.';
    if (!Number.isFinite(record.finalConfidence) || record.finalConfidence < 0 || record.finalConfidence > 100) return 'finalConfidence must be between 0 and 100.';
    if (!Number.isInteger(record.suggestionCount) || record.suggestionCount < 0) return 'suggestionCount must be non-negative integer.';
    if (!Number.isInteger(record.favorableSuggestionCount) || record.favorableSuggestionCount < 0 || record.favorableSuggestionCount > record.suggestionCount) return 'favorableSuggestionCount must be valid.';
    if (!this.isMeaningful(record.operatorStatus)) return 'operatorStatus must be meaningful.';
    if (!this.isMeaningful(record.consensusDecision)) return 'consensusDecision must be meaningful.';
    if (!this.isMeaningful(record.strategyReputation)) return 'strategyReputation must be meaningful.';
    if (!this.isMeaningful(record.tableReputation)) return 'tableReputation must be meaningful.';

    if (!Array.isArray(record.notes) || record.notes.length > 50) return 'notes must contain at most 50 items.';

    for (const note of record.notes) {
      if (!this.isMeaningful(note)) return 'each note must be meaningful.';
    }

    return null;
  }

  private validateIndex(record: InstitutionalMemoryIndexRecord): string | null {
    if (!this.isSafeToken(record.key, 3, 128)) return 'index.key must be safe token.';
    if (!Number.isInteger(record.updatedAtEpochMs) || record.updatedAtEpochMs <= 0) return 'index.updatedAtEpochMs must be positive integer.';
    if (!Number.isInteger(record.sampleSize) || record.sampleSize < 0 || record.sampleSize > 1000000) return 'index.sampleSize must be valid.';
    if (!Number.isFinite(record.score) || record.score < 0 || record.score > 1) return 'index.score must be between 0 and 1.';
    if (!Number.isFinite(record.suggestedWeight) || record.suggestedWeight < 0 || record.suggestedWeight > 2) return 'index.suggestedWeight must be between 0 and 2.';
    if (!this.isMeaningful(record.decision)) return 'index.decision must be meaningful.';

    return null;
  }

  private toSessionRecord(value: Readonly<Record<string, unknown>>): InstitutionalMemorySessionRecord | null {
    const notes = value.notes;

    if (!Array.isArray(notes) || !notes.every((item): item is string => typeof item === 'string')) {
      return null;
    }

    const record: InstitutionalMemorySessionRecord = {
      sessionId: String(value.sessionId ?? ''),
      tableId: String(value.tableId ?? ''),
      strategyId: String(value.strategyId ?? ''),
      startedAtEpochMs: Number(value.startedAtEpochMs),
      finishedAtEpochMs: Number(value.finishedAtEpochMs),
      roundCount: Number(value.roundCount),
      finalStatus: String(value.finalStatus ?? ''),
      finalConfidence: Number(value.finalConfidence),
      suggestionCount: Number(value.suggestionCount),
      favorableSuggestionCount: Number(value.favorableSuggestionCount),
      operatorStatus: String(value.operatorStatus ?? ''),
      consensusDecision: String(value.consensusDecision ?? ''),
      strategyReputation: String(value.strategyReputation ?? ''),
      tableReputation: String(value.tableReputation ?? ''),
      notes,
      productionMoneyAllowed: false,
      liveMoneyAuthorization: false,
    };

    return this.validateSession(record) === null ? record : null;
  }

  private toIndexRecord(value: Readonly<Record<string, unknown>>): InstitutionalMemoryIndexRecord | null {
    const record: InstitutionalMemoryIndexRecord = {
      key: String(value.key ?? ''),
      updatedAtEpochMs: Number(value.updatedAtEpochMs),
      sampleSize: Number(value.sampleSize),
      score: Number(value.score),
      suggestedWeight: Number(value.suggestedWeight),
      decision: String(value.decision ?? ''),
      productionMoneyAllowed: false,
      liveMoneyAuthorization: false,
    };

    return this.validateIndex(record) === null ? record : null;
  }

  private parseJsonObject(raw: string): Readonly<Record<string, unknown>> | null {
    try {
      const parsed: unknown = JSON.parse(raw);

      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        return null;
      }

      return parsed as Readonly<Record<string, unknown>>;
    } catch {
      return null;
    }
  }

  private hasLiveMoneyViolation(record: { readonly productionMoneyAllowed?: boolean; readonly liveMoneyAuthorization?: boolean }): string | null {
    if (record.productionMoneyAllowed === true || record.liveMoneyAuthorization === true) {
      return 'Institutional memory repository cannot persist live money enabled records.';
    }

    return null;
  }

  private isMeaningful(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length >= 3 && value.length <= 240;
  }

  private isSafeToken(value: unknown, min: number, max: number): value is string {
    return (
      typeof value === 'string' &&
      value.length >= min &&
      value.length <= max &&
      /^[0-9A-Za-z._:-]+$/.test(value)
    );
  }

  private ok<T>(value: T): InstitutionalMemoryRepositoryResult<T> {
    return {
      ok: true,
      value,
      productionMoneyAllowed: false,
      liveMoneyAuthorization: false,
    };
  }

  private fail<T>(
    reason: InstitutionalMemoryRepositoryReason,
    message: string,
  ): InstitutionalMemoryRepositoryResult<T> {
    return {
      ok: false,
      error: {
        reason,
        message,
        productionMoneyAllowed: false,
        liveMoneyAuthorization: false,
      },
    };
  }

  private ioError<T>(error: unknown): InstitutionalMemoryRepositoryResult<T> {
    return this.fail(
      'INSTITUTIONAL_MEMORY_IO_ERROR',
      error instanceof Error ? error.message : 'Unknown institutional memory repository I/O error.',
    );
  }
}
