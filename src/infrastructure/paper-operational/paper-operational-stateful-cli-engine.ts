import { PaperOperationalCliModeEngine } from '../../domain/bankroll/paper-operational-cli-mode-engine';
import type {
  PaperOperationalCliInput,
  PaperOperationalCliResponse,
} from '../../domain/bankroll/paper-operational-cli-mode-engine';
import { PaperOperationalStateStore } from './paper-operational-state-store';
import type {
  PaperOperationalPersistedState,
  PaperOperationalStateStoreResult,
} from './paper-operational-state-store';

export type PaperOperationalStatefulCommand =
  | 'prepare'
  | 'status'
  | 'open-paper'
  | 'settle-win'
  | 'settle-loss'
  | 'settle-push'
  | 'snapshot'
  | 'recover'
  | 'finish'
  | 'demo';

export type PaperOperationalStatefulReason =
  | 'PAPER_STATEFUL_COMMAND_EXECUTED'
  | 'PAPER_STATEFUL_STATUS_LOADED'
  | 'PAPER_STATEFUL_STATUS_EMPTY'
  | 'PAPER_STATEFUL_STATE_SAVED'
  | 'INVALID_PAPER_STATEFUL_COMMAND'
  | 'INVALID_PAPER_STATEFUL_INPUT'
  | 'PAPER_STATEFUL_PERSISTENCE_ERROR'
  | 'LIVE_MONEY_FORBIDDEN';

export interface PaperOperationalStatefulInput {
  readonly command: PaperOperationalStatefulCommand | string;
  readonly sessionId?: string;
  readonly tradeId?: string;
  readonly balance?: number;
  readonly stake?: number;
  readonly timestamp?: number;
  readonly productionMoneyAllowed?: boolean;
  readonly liveMoneyAuthorization?: boolean;
}

export interface PaperOperationalStatefulResponse {
  readonly ok: boolean;
  readonly command: string;
  readonly reason: PaperOperationalStatefulReason;
  readonly sessionId: string;
  readonly persisted: boolean;
  readonly productionMoneyAllowed: false;
  readonly liveMoneyAuthorization: false;
  readonly message: string;
  readonly state?: PaperOperationalPersistedState;
  readonly response?: PaperOperationalCliResponse;
}

export type PaperOperationalStatefulResult =
  | {
      readonly ok: true;
      readonly value: PaperOperationalStatefulResponse;
    }
  | {
      readonly ok: false;
      readonly error: {
        readonly reason: PaperOperationalStatefulReason;
        readonly message: string;
        readonly productionMoneyAllowed: false;
        readonly liveMoneyAuthorization: false;
      };
    };

/**
 * PaperOperationalStatefulCliEngine
 *
 * Adaptador de aplicação/infraestrutura para comandos PAPER com estado
 * persistido. Ele usa o domínio PAPER já existente e salva o último estado em
 * PaperOperationalStateStore.
 *
 * Regras:
 * - domínio permanece puro;
 * - persistência fica fora do domínio;
 * - live money sempre bloqueado;
 * - comandos são idempotentes quando o estado salvo é igual;
 * - complexidade O(n) apenas no tamanho bounded do JSON persistido.
 */
export class PaperOperationalStatefulCliEngine {
  private readonly cliEngine: PaperOperationalCliModeEngine;
  private readonly store: PaperOperationalStateStore;

  public constructor(store: PaperOperationalStateStore, cliEngine: PaperOperationalCliModeEngine = new PaperOperationalCliModeEngine()) {
    this.store = store;
    this.cliEngine = cliEngine;
  }

  public execute(input: PaperOperationalStatefulInput): PaperOperationalStatefulResult {
    if (input.productionMoneyAllowed === true || input.liveMoneyAuthorization === true) {
      return this.fail('LIVE_MONEY_FORBIDDEN', 'Stateful PAPER CLI cannot run with live money flags enabled.');
    }

    if (!this.isKnownCommand(input.command)) {
      return this.fail('INVALID_PAPER_STATEFUL_COMMAND', `Unknown stateful PAPER command: ${String(input.command)}`);
    }

    if (input.command === 'status') {
      return this.status(input);
    }

    const commandResult = this.cliEngine.execute({
      command: input.command,
      sessionId: input.sessionId,
      tradeId: input.tradeId,
      balance: input.balance,
      stake: input.stake,
      timestamp: input.timestamp,
      productionMoneyAllowed: false,
      liveMoneyAuthorization: false,
    });

    if (!commandResult.ok) {
      return this.fail('INVALID_PAPER_STATEFUL_INPUT', commandResult.error.message);
    }

    const sessionId = this.resolveSessionId(input);
    const state = this.createPersistedState(input.command, sessionId, commandResult.value, input.timestamp);
    const save = this.store.save({ state });

    if (!save.ok) {
      return this.fail('PAPER_STATEFUL_PERSISTENCE_ERROR', save.error.message);
    }

    return {
      ok: true,
      value: {
        ok: true,
        command: input.command,
        reason: save.reason === 'PAPER_OPERATIONAL_STATE_REPLAYED_IDEMPOTENTLY'
          ? 'PAPER_STATEFUL_COMMAND_EXECUTED'
          : 'PAPER_STATEFUL_STATE_SAVED',
        sessionId,
        persisted: true,
        productionMoneyAllowed: false,
        liveMoneyAuthorization: false,
        message: commandResult.value.message,
        state: save.state,
        response: commandResult.value,
      },
    };
  }

  private status(input: PaperOperationalStatefulInput): PaperOperationalStatefulResult {
    const loaded = this.store.load();

    if (!loaded.ok) {
      return this.fail('PAPER_STATEFUL_PERSISTENCE_ERROR', loaded.error.message);
    }

    if (loaded.reason === 'PAPER_OPERATIONAL_STATE_NOT_FOUND' || loaded.state === undefined) {
      return {
        ok: true,
        value: {
          ok: true,
          command: 'status',
          reason: 'PAPER_STATEFUL_STATUS_EMPTY',
          sessionId: this.resolveSessionId(input),
          persisted: false,
          productionMoneyAllowed: false,
          liveMoneyAuthorization: false,
          message: 'Nenhum estado PAPER persistido encontrado.',
        },
      };
    }

    return {
      ok: true,
      value: {
        ok: true,
        command: 'status',
        reason: 'PAPER_STATEFUL_STATUS_LOADED',
        sessionId: loaded.state.sessionId,
        persisted: true,
        productionMoneyAllowed: false,
        liveMoneyAuthorization: false,
        message: 'Estado PAPER persistido carregado.',
        state: loaded.state,
      },
    };
  }

  private createPersistedState(
    command: PaperOperationalStatefulCommand,
    sessionId: string,
    response: PaperOperationalCliResponse,
    timestamp: number | undefined,
  ): PaperOperationalPersistedState {
    return Object.freeze({
      sessionId,
      schemaVersion: 1,
      savedAtEpochMs: this.resolveTimestamp(timestamp),
      productionMoneyAllowed: false,
      liveMoneyAuthorization: false,
      payload: Object.freeze({
        command,
        lifecycleState: this.mapLifecycleState(command),
        response,
        productionMoneyAllowed: false,
        liveMoneyAuthorization: false,
      }),
    });
  }

  private mapLifecycleState(command: PaperOperationalStatefulCommand): string {
    if (command === 'prepare') {
      return 'PREPARED';
    }

    if (command === 'open-paper') {
      return 'ENTRY_OPEN';
    }

    if (command === 'settle-win' || command === 'settle-loss' || command === 'settle-push' || command === 'demo') {
      return 'SETTLED';
    }

    if (command === 'snapshot') {
      return 'SNAPSHOT_CREATED';
    }

    if (command === 'recover') {
      return 'RECOVERED';
    }

    if (command === 'finish') {
      return 'FINISHED';
    }

    return 'UNKNOWN';
  }

  private resolveSessionId(input: PaperOperationalStatefulInput): string {
    return input.sessionId ?? 'paper-session-stateful';
  }

  private resolveTimestamp(timestamp: number | undefined): number {
    return Number.isInteger(timestamp) && Number(timestamp) > 0
      ? Number(timestamp)
      : 1717200000200;
  }

  private isKnownCommand(command: string): command is PaperOperationalStatefulCommand {
    return (
      command === 'prepare' ||
      command === 'status' ||
      command === 'open-paper' ||
      command === 'settle-win' ||
      command === 'settle-loss' ||
      command === 'settle-push' ||
      command === 'snapshot' ||
      command === 'recover' ||
      command === 'finish' ||
      command === 'demo'
    );
  }

  private fail(reason: PaperOperationalStatefulReason, message: string): PaperOperationalStatefulResult {
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
