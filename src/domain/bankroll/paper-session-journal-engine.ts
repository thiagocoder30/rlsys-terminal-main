export type PaperSessionJournalEventType =
  | 'SESSION_STARTED'
  | 'RISK_EVALUATED'
  | 'PAPER_ENTRY_OPENED'
  | 'PAPER_TRADE_SETTLED'
  | 'SESSION_FINISHED';

export type PaperSessionJournalReason =
  | 'PAPER_SESSION_JOURNAL_APPENDED'
  | 'PAPER_SESSION_JOURNAL_REPLAYED_IDEMPOTENTLY'
  | 'PAPER_SESSION_JOURNAL_BOUNDED_APPEND'
  | 'DUPLICATE_JOURNAL_EVENT_CONFLICT'
  | 'INVALID_PAPER_SESSION_JOURNAL_INPUT'
  | 'LIVE_MONEY_FORBIDDEN';

export interface PaperSessionJournalEvent {
  readonly eventId: string;
  readonly sessionId: string;
  readonly type: PaperSessionJournalEventType;
  readonly occurredAtEpochMs: number;
  readonly sequence: number;
  readonly summary: string;
  readonly productionMoneyAllowed: false;
  readonly liveMoneyAuthorization: false;
  readonly version: 1;
}

export interface PaperSessionJournalSnapshot {
  readonly sessionId: string;
  readonly events: readonly PaperSessionJournalEvent[];
  readonly totalEvents: number;
  readonly lastSequence: number;
  readonly maxEvents: number;
  readonly productionMoneyAllowed: false;
  readonly liveMoneyAuthorization: false;
  readonly version: 1;
}

export interface PaperSessionJournalAppendInput {
  readonly sessionId: string;
  readonly eventId: string;
  readonly type: PaperSessionJournalEventType;
  readonly occurredAtEpochMs: number;
  readonly summary: string;
  readonly maxEvents: number;
  readonly previousJournal?: PaperSessionJournalSnapshot;
  readonly productionMoneyAllowed?: boolean;
  readonly liveMoneyAuthorization?: boolean;
}

export interface PaperSessionJournalEvaluation {
  readonly reason: PaperSessionJournalReason;
  readonly event: PaperSessionJournalEvent;
  readonly journal: PaperSessionJournalSnapshot;
  readonly productionMoneyAllowed: false;
  readonly liveMoneyAuthorization: false;
  readonly explanation: string;
}

export type PaperSessionJournalResult =
  | {
      readonly ok: true;
      readonly value: PaperSessionJournalEvaluation;
    }
  | {
      readonly ok: false;
      readonly error: {
        readonly reason: PaperSessionJournalReason;
        readonly message: string;
        readonly productionMoneyAllowed: false;
        readonly liveMoneyAuthorization: false;
      };
    };

/**
 * PaperSessionJournalEngine
 *
 * Diário de domínio para sessões PAPER. Ele não escreve arquivo e não depende
 * de infraestrutura. A persistência futura deve consumir o snapshot emitido.
 *
 * Regras:
 * - eventos bounded por maxEvents;
 * - append idempotente por eventId;
 * - conflito rejeitado quando eventId é reutilizado com payload diferente;
 * - live money sempre bloqueado.
 *
 * Complexidade: O(n) no número de eventos mantidos, com n limitado por maxEvents.
 */
export class PaperSessionJournalEngine {
  public append(input: PaperSessionJournalAppendInput): PaperSessionJournalResult {
    const invalidReason = this.validateInput(input);

    if (invalidReason !== null) {
      return this.fail('INVALID_PAPER_SESSION_JOURNAL_INPUT', invalidReason);
    }

    if (input.productionMoneyAllowed === true || input.liveMoneyAuthorization === true) {
      return this.fail('LIVE_MONEY_FORBIDDEN', 'Paper session journal cannot run with live money flags enabled.');
    }

    const previousJournal = input.previousJournal ?? this.createEmptyJournal(input.sessionId, input.maxEvents);

    if (previousJournal.productionMoneyAllowed !== false || previousJournal.liveMoneyAuthorization !== false) {
      return this.fail('LIVE_MONEY_FORBIDDEN', 'Paper session journal must keep live money disabled.');
    }

    if (previousJournal.sessionId !== input.sessionId) {
      return this.fail('INVALID_PAPER_SESSION_JOURNAL_INPUT', 'previousJournal.sessionId must match input.sessionId.');
    }

    const replay = this.findEvent(previousJournal, input.eventId);

    if (replay !== undefined) {
      return this.replay(input, previousJournal, replay);
    }

    const event: PaperSessionJournalEvent = Object.freeze({
      eventId: input.eventId,
      sessionId: input.sessionId,
      type: input.type,
      occurredAtEpochMs: input.occurredAtEpochMs,
      sequence: previousJournal.lastSequence + 1,
      summary: input.summary,
      productionMoneyAllowed: false,
      liveMoneyAuthorization: false,
      version: 1,
    });

    const boundedEvents = [...previousJournal.events, event].slice(-input.maxEvents);

    const journal: PaperSessionJournalSnapshot = Object.freeze({
      sessionId: input.sessionId,
      events: Object.freeze(boundedEvents),
      totalEvents: previousJournal.totalEvents + 1,
      lastSequence: event.sequence,
      maxEvents: input.maxEvents,
      productionMoneyAllowed: false,
      liveMoneyAuthorization: false,
      version: 1,
    });

    return {
      ok: true,
      value: {
        reason:
          boundedEvents.length < previousJournal.events.length + 1
            ? 'PAPER_SESSION_JOURNAL_BOUNDED_APPEND'
            : 'PAPER_SESSION_JOURNAL_APPENDED',
        event,
        journal,
        productionMoneyAllowed: false,
        liveMoneyAuthorization: false,
        explanation: 'Evento PAPER registrado no journal de domínio com live money bloqueado.',
      },
    };
  }

  private replay(
    input: PaperSessionJournalAppendInput,
    journal: PaperSessionJournalSnapshot,
    existingEvent: PaperSessionJournalEvent,
  ): PaperSessionJournalResult {
    const samePayload =
      existingEvent.sessionId === input.sessionId &&
      existingEvent.type === input.type &&
      existingEvent.occurredAtEpochMs === input.occurredAtEpochMs &&
      existingEvent.summary === input.summary &&
      existingEvent.productionMoneyAllowed === false &&
      existingEvent.liveMoneyAuthorization === false;

    if (!samePayload) {
      return this.fail(
        'DUPLICATE_JOURNAL_EVENT_CONFLICT',
        'Repeated journal eventId must preserve immutable event payload.',
      );
    }

    return {
      ok: true,
      value: {
        reason: 'PAPER_SESSION_JOURNAL_REPLAYED_IDEMPOTENTLY',
        event: existingEvent,
        journal,
        productionMoneyAllowed: false,
        liveMoneyAuthorization: false,
        explanation: 'Evento PAPER repetido detectado como replay idempotente.',
      },
    };
  }

  private createEmptyJournal(sessionId: string, maxEvents: number): PaperSessionJournalSnapshot {
    return Object.freeze({
      sessionId,
      events: Object.freeze([]),
      totalEvents: 0,
      lastSequence: 0,
      maxEvents,
      productionMoneyAllowed: false,
      liveMoneyAuthorization: false,
      version: 1,
    });
  }

  private findEvent(
    journal: PaperSessionJournalSnapshot,
    eventId: string,
  ): PaperSessionJournalEvent | undefined {
    for (const event of journal.events) {
      if (event.eventId === eventId) {
        return event;
      }
    }

    return undefined;
  }

  private validateInput(input: PaperSessionJournalAppendInput): string | null {
    if (typeof input !== 'object' || input === null) {
      return 'Input must be an object.';
    }

    if (!this.isSafeToken(input.sessionId, 3, 96)) {
      return 'sessionId must be a safe token with 3 to 96 characters.';
    }

    if (!this.isSafeToken(input.eventId, 3, 96)) {
      return 'eventId must be a safe token with 3 to 96 characters.';
    }

    if (
      input.type !== 'SESSION_STARTED' &&
      input.type !== 'RISK_EVALUATED' &&
      input.type !== 'PAPER_ENTRY_OPENED' &&
      input.type !== 'PAPER_TRADE_SETTLED' &&
      input.type !== 'SESSION_FINISHED'
    ) {
      return 'type must be a valid paper journal event type.';
    }

    if (!Number.isInteger(input.occurredAtEpochMs) || input.occurredAtEpochMs <= 0) {
      return 'occurredAtEpochMs must be a positive integer.';
    }

    if (typeof input.summary !== 'string' || input.summary.trim().length < 3 || input.summary.length > 240) {
      return 'summary must contain 3 to 240 characters.';
    }

    if (!Number.isInteger(input.maxEvents) || input.maxEvents < 1 || input.maxEvents > 1000) {
      return 'maxEvents must be an integer between 1 and 1000.';
    }

    return null;
  }

  private isSafeToken(value: string, min: number, max: number): boolean {
    return typeof value === 'string' && value.length >= min && value.length <= max && /^[0-9A-Za-z._:-]+$/.test(value);
  }

  private fail(reason: PaperSessionJournalReason, message: string): PaperSessionJournalResult {
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
