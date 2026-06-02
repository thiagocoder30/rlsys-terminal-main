import * as fs from 'fs';
import * as path from 'path';

export type PaperOperationalPersistenceReason =
  | 'PAPER_OPERATIONAL_STATE_SAVED'
  | 'PAPER_OPERATIONAL_STATE_REPLAYED_IDEMPOTENTLY'
  | 'PAPER_OPERATIONAL_STATE_LOADED'
  | 'PAPER_OPERATIONAL_STATE_NOT_FOUND'
  | 'INVALID_PAPER_OPERATIONAL_STATE'
  | 'PAPER_OPERATIONAL_STATE_CORRUPTED'
  | 'PERSISTENCE_IO_ERROR';

export interface PaperOperationalPersistedState {
  readonly sessionId: string;
  readonly schemaVersion: 1;
  readonly savedAtEpochMs: number;
  readonly productionMoneyAllowed: false;
  readonly liveMoneyAuthorization: false;
  readonly payload: Readonly<Record<string, unknown>>;
}

export interface PaperOperationalStateStoreConfig {
  readonly filePath: string;
  readonly maxBytes: number;
}

export interface PaperOperationalStateSaveInput {
  readonly state: PaperOperationalPersistedState;
  readonly previousState?: PaperOperationalPersistedState;
}

export type PaperOperationalStateStoreResult =
  | {
      readonly ok: true;
      readonly reason: PaperOperationalPersistenceReason;
      readonly state?: PaperOperationalPersistedState;
      readonly filePath: string;
      readonly explanation: string;
    }
  | {
      readonly ok: false;
      readonly error: {
        readonly reason: PaperOperationalPersistenceReason;
        readonly message: string;
        readonly productionMoneyAllowed: false;
        readonly liveMoneyAuthorization: false;
      };
    };

/**
 * Adaptador de infraestrutura para persistência atômica do modo PAPER.
 * Mantém Clean Architecture: domínio puro, persistência fora do domínio.
 */
export class PaperOperationalStateStore {
  private readonly filePath: string;
  private readonly maxBytes: number;

  public constructor(config: PaperOperationalStateStoreConfig) {
    this.filePath = path.resolve(config.filePath);
    this.maxBytes = config.maxBytes;
  }

  public save(input: PaperOperationalStateSaveInput): PaperOperationalStateStoreResult {
    const validationError = this.validateState(input.state);

    if (validationError !== null) {
      return this.fail('INVALID_PAPER_OPERATIONAL_STATE', validationError);
    }

    if (!Number.isInteger(this.maxBytes) || this.maxBytes < 512 || this.maxBytes > 5_000_000) {
      return this.fail('INVALID_PAPER_OPERATIONAL_STATE', 'maxBytes must be an integer between 512 and 5000000.');
    }

    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });

      const existingState = input.previousState ?? this.tryLoadExistingState();

      if (existingState !== undefined && this.sameState(existingState, input.state)) {
        return {
          ok: true,
          reason: 'PAPER_OPERATIONAL_STATE_REPLAYED_IDEMPOTENTLY',
          state: existingState,
          filePath: this.filePath,
          explanation: 'Estado PAPER já estava persistido de forma idempotente.',
        };
      }

      const serialized = `${JSON.stringify(input.state, null, 2)}\n`;
      const byteLength = Buffer.byteLength(serialized, 'utf8');

      if (byteLength > this.maxBytes) {
        return this.fail(
          'INVALID_PAPER_OPERATIONAL_STATE',
          `Serialized paper operational state exceeds maxBytes: ${byteLength} > ${this.maxBytes}.`,
        );
      }

      const tempPath = `${this.filePath}.tmp-${process.pid}-${Date.now()}`;

      fs.writeFileSync(tempPath, serialized, { encoding: 'utf8', flag: 'wx' });
      fs.renameSync(tempPath, this.filePath);

      return {
        ok: true,
        reason: 'PAPER_OPERATIONAL_STATE_SAVED',
        state: input.state,
        filePath: this.filePath,
        explanation: 'Estado PAPER salvo de forma atômica em infraestrutura.',
      };
    } catch (error) {
      return this.fail(
        'PERSISTENCE_IO_ERROR',
        error instanceof Error ? error.message : 'Unknown persistence save error.',
      );
    }
  }

  public load(): PaperOperationalStateStoreResult {
    try {
      if (!fs.existsSync(this.filePath)) {
        return {
          ok: true,
          reason: 'PAPER_OPERATIONAL_STATE_NOT_FOUND',
          filePath: this.filePath,
          explanation: 'Nenhum estado PAPER persistido encontrado.',
        };
      }

      const stat = fs.statSync(this.filePath);

      if (stat.size > this.maxBytes) {
        return this.fail('PAPER_OPERATIONAL_STATE_CORRUPTED', 'Persisted paper state exceeds configured maxBytes.');
      }

      const raw = fs.readFileSync(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as unknown;

      if (!this.isRecord(parsed)) {
        return this.fail('PAPER_OPERATIONAL_STATE_CORRUPTED', 'Persisted paper state is not a JSON object.');
      }

      const state = parsed as unknown as PaperOperationalPersistedState;
      const validationError = this.validateState(state);

      if (validationError !== null) {
        return this.fail('PAPER_OPERATIONAL_STATE_CORRUPTED', validationError);
      }

      return {
        ok: true,
        reason: 'PAPER_OPERATIONAL_STATE_LOADED',
        state,
        filePath: this.filePath,
        explanation: 'Estado PAPER carregado com invariantes institucionais preservadas.',
      };
    } catch (error) {
      return this.fail(
        'PERSISTENCE_IO_ERROR',
        error instanceof Error ? error.message : 'Unknown persistence load error.',
      );
    }
  }

  private tryLoadExistingState(): PaperOperationalPersistedState | undefined {
    const loaded = this.load();

    if (!loaded.ok || loaded.reason !== 'PAPER_OPERATIONAL_STATE_LOADED' || loaded.state === undefined) {
      return undefined;
    }

    return loaded.state;
  }

  private validateState(state: PaperOperationalPersistedState): string | null {
    if (!this.isRecord(state)) {
      return 'state must be an object.';
    }

    if (!this.isSafeToken(state.sessionId, 3, 96)) {
      return 'state.sessionId must be a safe token with 3 to 96 characters.';
    }

    if (state.schemaVersion !== 1) {
      return 'state.schemaVersion must be 1.';
    }

    if (!Number.isInteger(state.savedAtEpochMs) || state.savedAtEpochMs <= 0) {
      return 'state.savedAtEpochMs must be a positive integer.';
    }

    if (state.productionMoneyAllowed !== false || state.liveMoneyAuthorization !== false) {
      return 'Paper operational persistence requires live money flags to be false.';
    }

    if (!this.isRecord(state.payload)) {
      return 'state.payload must be an object.';
    }

    if (this.containsForbiddenLiveMoneyFlag(state.payload)) {
      return 'state.payload cannot contain live money enabled flags.';
    }

    return null;
  }

  private containsForbiddenLiveMoneyFlag(value: unknown): boolean {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (this.containsForbiddenLiveMoneyFlag(item)) {
          return true;
        }
      }
      return false;
    }

    if (!this.isRecord(value)) {
      return false;
    }

    if (value.productionMoneyAllowed === true || value.liveMoneyAuthorization === true) {
      return true;
    }

    for (const nestedValue of Object.values(value)) {
      if (this.containsForbiddenLiveMoneyFlag(nestedValue)) {
        return true;
      }
    }

    return false;
  }

  private sameState(left: PaperOperationalPersistedState, right: PaperOperationalPersistedState): boolean {
    return JSON.stringify(left) === JSON.stringify(right);
  }

  private isSafeToken(value: unknown, min: number, max: number): value is string {
    return (
      typeof value === 'string' &&
      value.length >= min &&
      value.length <= max &&
      /^[0-9A-Za-z._:-]+$/.test(value)
    );
  }

  private isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private fail(reason: PaperOperationalPersistenceReason, message: string): PaperOperationalStateStoreResult {
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
}
