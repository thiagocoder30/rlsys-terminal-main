import * as crypto from 'crypto';

export type PaperOperationalAuditAction =
  | 'prepare'
  | 'status'
  | 'open-paper'
  | 'settle-win'
  | 'settle-loss'
  | 'settle-push'
  | 'snapshot'
  | 'recover'
  | 'finish'
  | 'demo'
  | 'e2e-certification';

export type PaperOperationalAuditResult = 'PAPER_COMPATIVEL' | 'AGUARDAR' | 'NAO_UTILIZAR';

export type PaperOperationalAuditReason =
  | 'PAPER_OPERATIONAL_AUDIT_APPENDED'
  | 'PAPER_OPERATIONAL_AUDIT_REPLAYED_IDEMPOTENTLY'
  | 'PAPER_OPERATIONAL_AUDIT_CHAIN_VALID'
  | 'PAPER_OPERATIONAL_AUDIT_CHAIN_BROKEN'
  | 'DUPLICATE_AUDIT_EVENT_CONFLICT'
  | 'INVALID_PAPER_OPERATIONAL_AUDIT_INPUT'
  | 'LIVE_MONEY_FORBIDDEN';

export interface PaperOperationalAuditEventInput {
  readonly eventId: string;
  readonly sessionId: string;
  readonly tradeId?: string;
  readonly action: PaperOperationalAuditAction;
  readonly result: PaperOperationalAuditResult;
  readonly occurredAtEpochMs: number;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly previousLedger?: PaperOperationalAuditLedger;
  readonly productionMoneyAllowed?: boolean;
  readonly liveMoneyAuthorization?: boolean;
}

export interface PaperOperationalAuditEvent {
  readonly eventId: string;
  readonly sessionId: string;
  readonly tradeId?: string;
  readonly action: PaperOperationalAuditAction;
  readonly result: PaperOperationalAuditResult;
  readonly occurredAtEpochMs: number;
  readonly sequence: number;
  readonly previousHash: string;
  readonly integrityHash: string;
  readonly productionMoneyAllowed: false;
  readonly liveMoneyAuthorization: false;
  readonly version: 1;
}

export interface PaperOperationalAuditLedger {
  readonly sessionId: string;
  readonly events: readonly PaperOperationalAuditEvent[];
  readonly totalEvents: number;
  readonly lastSequence: number;
  readonly lastHash: string;
  readonly productionMoneyAllowed: false;
  readonly liveMoneyAuthorization: false;
  readonly version: 1;
}

export interface PaperOperationalAuditEvaluation {
  readonly reason: PaperOperationalAuditReason;
  readonly event?: PaperOperationalAuditEvent;
  readonly ledger: PaperOperationalAuditLedger;
  readonly productionMoneyAllowed: false;
  readonly liveMoneyAuthorization: false;
  readonly explanation: string;
}

export type PaperOperationalAuditResultEnvelope =
  | {
      readonly ok: true;
      readonly value: PaperOperationalAuditEvaluation;
    }
  | {
      readonly ok: false;
      readonly error: {
        readonly reason: PaperOperationalAuditReason;
        readonly message: string;
        readonly productionMoneyAllowed: false;
        readonly liveMoneyAuthorization: false;
      };
    };

/**
 * PaperOperationalAuditEngine
 *
 * Camada institucional de auditoria para operação PAPER. Ela gera eventos
 * imutáveis com hash encadeado, valida replay idempotente e rejeita qualquer
 * sinal de live money dentro do payload.
 *
 * Complexidade: O(n) no número de eventos auditados.
 */
export class PaperOperationalAuditEngine {
  private static readonly GENESIS_HASH = 'GENESIS_PAPER_AUDIT';

  public append(input: PaperOperationalAuditEventInput): PaperOperationalAuditResultEnvelope {
    const invalidReason = this.validateInput(input);

    if (invalidReason !== null) {
      return this.fail('INVALID_PAPER_OPERATIONAL_AUDIT_INPUT', invalidReason);
    }

    if (input.productionMoneyAllowed === true || input.liveMoneyAuthorization === true) {
      return this.fail('LIVE_MONEY_FORBIDDEN', 'Paper operational audit cannot run with live money flags enabled.');
    }

    if (this.containsForbiddenLiveMoneyFlag(input.payload)) {
      return this.fail('LIVE_MONEY_FORBIDDEN', 'Audit payload cannot contain enabled live money flags.');
    }

    const previousLedger = input.previousLedger ?? this.createEmptyLedger(input.sessionId);

    if (previousLedger.productionMoneyAllowed !== false || previousLedger.liveMoneyAuthorization !== false) {
      return this.fail('LIVE_MONEY_FORBIDDEN', 'Paper audit ledger must keep live money disabled.');
    }

    if (previousLedger.sessionId !== input.sessionId) {
      return this.fail('INVALID_PAPER_OPERATIONAL_AUDIT_INPUT', 'previousLedger.sessionId must match input.sessionId.');
    }

    const existingEvent = this.findEvent(previousLedger, input.eventId);

    if (existingEvent !== undefined) {
      return this.replay(input, previousLedger, existingEvent);
    }

    const sequence = previousLedger.lastSequence + 1;
    const previousHash = previousLedger.lastHash;
    const integrityHash = this.computeHash({
      eventId: input.eventId,
      sessionId: input.sessionId,
      tradeId: input.tradeId,
      action: input.action,
      result: input.result,
      occurredAtEpochMs: input.occurredAtEpochMs,
      sequence,
      previousHash,
      payload: input.payload,
    });

    const event: PaperOperationalAuditEvent = Object.freeze({
      eventId: input.eventId,
      sessionId: input.sessionId,
      tradeId: input.tradeId,
      action: input.action,
      result: input.result,
      occurredAtEpochMs: input.occurredAtEpochMs,
      sequence,
      previousHash,
      integrityHash,
      productionMoneyAllowed: false,
      liveMoneyAuthorization: false,
      version: 1,
    });

    const ledger: PaperOperationalAuditLedger = Object.freeze({
      sessionId: input.sessionId,
      events: Object.freeze([...previousLedger.events, event]),
      totalEvents: previousLedger.totalEvents + 1,
      lastSequence: sequence,
      lastHash: integrityHash,
      productionMoneyAllowed: false,
      liveMoneyAuthorization: false,
      version: 1,
    });

    return {
      ok: true,
      value: {
        reason: 'PAPER_OPERATIONAL_AUDIT_APPENDED',
        event,
        ledger,
        productionMoneyAllowed: false,
        liveMoneyAuthorization: false,
        explanation: 'Evento operacional PAPER auditado com hash de integridade encadeado.',
      },
    };
  }

  public verify(ledger: PaperOperationalAuditLedger): PaperOperationalAuditResultEnvelope {
    const invalidLedger = this.validateLedgerShape(ledger);

    if (invalidLedger !== null) {
      return this.fail('INVALID_PAPER_OPERATIONAL_AUDIT_INPUT', invalidLedger);
    }

    let expectedPreviousHash = PaperOperationalAuditEngine.GENESIS_HASH;

    for (const event of ledger.events) {
      if (event.previousHash !== expectedPreviousHash) {
        return {
          ok: true,
          value: {
            reason: 'PAPER_OPERATIONAL_AUDIT_CHAIN_BROKEN',
            ledger,
            productionMoneyAllowed: false,
            liveMoneyAuthorization: false,
            explanation: 'Cadeia de auditoria PAPER quebrada por previousHash divergente.',
          },
        };
      }

      expectedPreviousHash = event.integrityHash;
    }

    if (ledger.lastHash !== expectedPreviousHash || ledger.lastSequence !== ledger.events.length) {
      return {
        ok: true,
        value: {
          reason: 'PAPER_OPERATIONAL_AUDIT_CHAIN_BROKEN',
          ledger,
          productionMoneyAllowed: false,
          liveMoneyAuthorization: false,
          explanation: 'Cadeia de auditoria PAPER inconsistente nos metadados finais.',
        },
      };
    }

    return {
      ok: true,
      value: {
        reason: 'PAPER_OPERATIONAL_AUDIT_CHAIN_VALID',
        ledger,
        productionMoneyAllowed: false,
        liveMoneyAuthorization: false,
        explanation: 'Cadeia de auditoria PAPER validada estruturalmente.',
      },
    };
  }

  private replay(
    input: PaperOperationalAuditEventInput,
    ledger: PaperOperationalAuditLedger,
    existingEvent: PaperOperationalAuditEvent,
  ): PaperOperationalAuditResultEnvelope {
    const expectedHash = this.computeHash({
      eventId: input.eventId,
      sessionId: input.sessionId,
      tradeId: input.tradeId,
      action: input.action,
      result: input.result,
      occurredAtEpochMs: input.occurredAtEpochMs,
      sequence: existingEvent.sequence,
      previousHash: existingEvent.previousHash,
      payload: input.payload,
    });

    const sameEvent =
      existingEvent.sessionId === input.sessionId &&
      existingEvent.tradeId === input.tradeId &&
      existingEvent.action === input.action &&
      existingEvent.result === input.result &&
      existingEvent.occurredAtEpochMs === input.occurredAtEpochMs &&
      existingEvent.integrityHash === expectedHash &&
      existingEvent.productionMoneyAllowed === false &&
      existingEvent.liveMoneyAuthorization === false;

    if (!sameEvent) {
      return this.fail(
        'DUPLICATE_AUDIT_EVENT_CONFLICT',
        'Repeated audit eventId must preserve immutable event payload.',
      );
    }

    return {
      ok: true,
      value: {
        reason: 'PAPER_OPERATIONAL_AUDIT_REPLAYED_IDEMPOTENTLY',
        event: existingEvent,
        ledger,
        productionMoneyAllowed: false,
        liveMoneyAuthorization: false,
        explanation: 'Evento de auditoria PAPER repetido como replay idempotente.',
      },
    };
  }

  private createEmptyLedger(sessionId: string): PaperOperationalAuditLedger {
    return Object.freeze({
      sessionId,
      events: Object.freeze([]),
      totalEvents: 0,
      lastSequence: 0,
      lastHash: PaperOperationalAuditEngine.GENESIS_HASH,
      productionMoneyAllowed: false,
      liveMoneyAuthorization: false,
      version: 1,
    });
  }

  private findEvent(
    ledger: PaperOperationalAuditLedger,
    eventId: string,
  ): PaperOperationalAuditEvent | undefined {
    for (const event of ledger.events) {
      if (event.eventId === eventId) {
        return event;
      }
    }

    return undefined;
  }

  private computeHash(value: Readonly<Record<string, unknown>>): string {
    return crypto
      .createHash('sha256')
      .update(this.stableStringify(value))
      .digest('hex');
  }

  private stableStringify(value: unknown): string {
    if (value === null || typeof value !== 'object') {
      return JSON.stringify(value);
    }

    if (Array.isArray(value)) {
      return `[${value.map((item) => this.stableStringify(item)).join(',')}]`;
    }

    const record = value as Readonly<Record<string, unknown>>;
    const keys = Object.keys(record).sort();

    return `{${keys.map((key) => `${JSON.stringify(key)}:${this.stableStringify(record[key])}`).join(',')}}`;
  }

  private validateInput(input: PaperOperationalAuditEventInput): string | null {
    if (typeof input !== 'object' || input === null) {
      return 'input must be an object.';
    }

    if (!this.isSafeToken(input.eventId, 3, 128)) {
      return 'eventId must be a safe token with 3 to 128 characters.';
    }

    if (!this.isSafeToken(input.sessionId, 3, 96)) {
      return 'sessionId must be a safe token with 3 to 96 characters.';
    }

    if (input.tradeId !== undefined && !this.isSafeToken(input.tradeId, 3, 96)) {
      return 'tradeId must be a safe token with 3 to 96 characters when provided.';
    }

    if (!this.isKnownAction(input.action)) {
      return 'action must be a valid paper operational audit action.';
    }

    if (
      input.result !== 'PAPER_COMPATIVEL' &&
      input.result !== 'AGUARDAR' &&
      input.result !== 'NAO_UTILIZAR'
    ) {
      return 'result must be PAPER_COMPATIVEL, AGUARDAR, or NAO_UTILIZAR.';
    }

    if (!Number.isInteger(input.occurredAtEpochMs) || input.occurredAtEpochMs <= 0) {
      return 'occurredAtEpochMs must be a positive integer.';
    }

    if (!this.isRecord(input.payload)) {
      return 'payload must be an object.';
    }

    return null;
  }

  private validateLedgerShape(ledger: PaperOperationalAuditLedger): string | null {
    if (!this.isRecord(ledger)) {
      return 'ledger must be an object.';
    }

    if (!this.isSafeToken(ledger.sessionId, 3, 96)) {
      return 'ledger.sessionId is invalid.';
    }

    if (!Array.isArray(ledger.events)) {
      return 'ledger.events must be an array.';
    }

    if (!Number.isInteger(ledger.totalEvents) || ledger.totalEvents !== ledger.events.length) {
      return 'ledger.totalEvents must match events length.';
    }

    if (!Number.isInteger(ledger.lastSequence) || ledger.lastSequence < 0) {
      return 'ledger.lastSequence must be a non-negative integer.';
    }

    if (typeof ledger.lastHash !== 'string' || ledger.lastHash.length < 10) {
      return 'ledger.lastHash is invalid.';
    }

    if (ledger.productionMoneyAllowed !== false || ledger.liveMoneyAuthorization !== false) {
      return 'ledger live money invariants are violated.';
    }

    if (ledger.version !== 1) {
      return 'ledger.version must be 1.';
    }

    for (const event of ledger.events) {
      if (event.productionMoneyAllowed !== false || event.liveMoneyAuthorization !== false) {
        return 'event live money invariants are violated.';
      }

      if (event.sessionId !== ledger.sessionId) {
        return 'all events must belong to the ledger sessionId.';
      }
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

  private isKnownAction(action: PaperOperationalAuditAction): boolean {
    return (
      action === 'prepare' ||
      action === 'status' ||
      action === 'open-paper' ||
      action === 'settle-win' ||
      action === 'settle-loss' ||
      action === 'settle-push' ||
      action === 'snapshot' ||
      action === 'recover' ||
      action === 'finish' ||
      action === 'demo' ||
      action === 'e2e-certification'
    );
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

  private fail(reason: PaperOperationalAuditReason, message: string): PaperOperationalAuditResultEnvelope {
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
