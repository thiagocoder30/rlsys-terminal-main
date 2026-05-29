export type InstitutionalReplayEventType =
  | 'SESSION_STARTED'
  | 'ROUND_OBSERVED'
  | 'ASSISTED_SUGGESTION'
  | 'SUPERVISOR_VETO'
  | 'COOLDOWN_TRIGGERED'
  | 'SESSION_INTERRUPTED'
  | 'EXPLANATION_EMITTED'
  | 'SESSION_FINISHED';

export type InstitutionalReplayGate = 'BLOCKED';

export type InstitutionalReplayFinalState =
  | 'OBSERVED'
  | 'ASSISTED'
  | 'VETOED'
  | 'COOLDOWN'
  | 'INTERRUPTED'
  | 'INCOMPLETE';

export interface InstitutionalReplayEvent {
  readonly eventId: string;
  readonly timestamp: number;
  readonly type: InstitutionalReplayEventType;
  readonly round?: number;
  readonly riskPressure?: number;
  readonly reason?: string;
}

export interface InstitutionalReplayInput {
  readonly sessionId?: string;
  readonly replayId?: string;
  readonly events: readonly InstitutionalReplayEvent[];
}

export interface InstitutionalReplayTimelineItem {
  readonly sequence: number;
  readonly eventId: string;
  readonly timestamp: number;
  readonly type: InstitutionalReplayEventType;
  readonly riskPressure: number;
  readonly marker: string;
}

export interface InstitutionalReplayCounters {
  readonly roundsObserved: number;
  readonly assistedSuggestions: number;
  readonly supervisorVetoes: number;
  readonly cooldowns: number;
  readonly interruptions: number;
  readonly explanations: number;
}

export interface InstitutionalReplayReport {
  readonly replayId: string;
  readonly sessionId: string;
  readonly eventsObserved: number;
  readonly timeline: readonly InstitutionalReplayTimelineItem[];
  readonly counters: InstitutionalReplayCounters;
  readonly finalState: InstitutionalReplayFinalState;
  readonly integrityScore: number;
  readonly highestRiskPressure: number;
  readonly hasTerminalInterruption: boolean;
  readonly gate: InstitutionalReplayGate;
  readonly operationalGate: InstitutionalReplayGate;
  readonly paperSessionGate: InstitutionalReplayGate;
  readonly liveSessionGate: InstitutionalReplayGate;
  readonly auditTrail: readonly string[];
}

const MAX_REPLAY_EVENTS = 500;

export class InstitutionalReplayEngine {
  public replay(
    input: InstitutionalReplayInput
  ): InstitutionalReplayReport {
    this.assertInput(input);

    const replayId =
      this.resolveId(
        input.replayId,
        'institutional-replay-runtime'
      );

    const sessionId =
      this.resolveId(
        input.sessionId,
        'institutional-session-runtime'
      );

    const acceptedEvents =
      input.events.slice(0, MAX_REPLAY_EVENTS);

    const timeline:
      InstitutionalReplayTimelineItem[] = [];

    let roundsObserved = 0;
    let assistedSuggestions = 0;
    let supervisorVetoes = 0;
    let cooldowns = 0;
    let interruptions = 0;
    let explanations = 0;
    let highestRiskPressure = 0;
    let integrityPenalties = 0;
    let previousTimestamp =
      Number.NEGATIVE_INFINITY;

    for (
      let index = 0;
      index < acceptedEvents.length;
      index += 1
    ) {
      const event = acceptedEvents[index];

      this.assertEvent(event);

      if (
        event.timestamp <
        previousTimestamp
      ) {
        integrityPenalties += 8;
      }

      previousTimestamp =
        event.timestamp;

      const riskPressure =
        this.normalizeRiskPressure(
          event.riskPressure
        );

      highestRiskPressure =
        Math.max(
          highestRiskPressure,
          riskPressure
        );

      switch (event.type) {
        case 'ROUND_OBSERVED':
          roundsObserved += 1;
          break;

        case 'ASSISTED_SUGGESTION':
          assistedSuggestions += 1;
          break;

        case 'SUPERVISOR_VETO':
          supervisorVetoes += 1;
          break;

        case 'COOLDOWN_TRIGGERED':
          cooldowns += 1;
          break;

        case 'SESSION_INTERRUPTED':
          interruptions += 1;
          break;

        case 'EXPLANATION_EMITTED':
          explanations += 1;
          break;

        case 'SESSION_STARTED':
        case 'SESSION_FINISHED':
          break;
      }

      timeline.push(
        Object.freeze({
          sequence: index + 1,
          eventId: event.eventId,
          timestamp: event.timestamp,
          type: event.type,
          riskPressure,
          marker:
            typeof event.reason === 'string' &&
            event.reason.trim().length > 0
              ? event.reason.trim()
              : event.type
        })
      );
    }

    if (
      input.events.length >
      MAX_REPLAY_EVENTS
    ) {
      integrityPenalties += 12;
    }

    const counters:
      InstitutionalReplayCounters =
      Object.freeze({
        roundsObserved,
        assistedSuggestions,
        supervisorVetoes,
        cooldowns,
        interruptions,
        explanations
      });

    const finalState =
      this.finalStateFor(
        counters,
        acceptedEvents.length
      );

    const integrityScore =
      this.clamp(
        100 - integrityPenalties,
        0,
        100
      );

    return Object.freeze({
      replayId,
      sessionId,
      eventsObserved:
        acceptedEvents.length,

      timeline:
        Object.freeze(timeline),

      counters,

      finalState,

      integrityScore,

      highestRiskPressure:
        this.round(
          highestRiskPressure
        ),

      hasTerminalInterruption:
        interruptions > 0,

      gate: 'BLOCKED',
      operationalGate: 'BLOCKED',
      paperSessionGate: 'BLOCKED',
      liveSessionGate: 'BLOCKED',

      auditTrail:
        this.auditTrailFor(
          counters,
          finalState,
          integrityScore
        )
    });
  }

  public evaluate(
    input: InstitutionalReplayInput
  ): InstitutionalReplayReport {
    return this.replay(input);
  }

  public execute(
    input: InstitutionalReplayInput
  ): InstitutionalReplayReport {
    return this.replay(input);
  }

  private finalStateFor(
    counters: InstitutionalReplayCounters,
    eventsObserved: number
  ): InstitutionalReplayFinalState {
    if (eventsObserved === 0) {
      return 'INCOMPLETE';
    }

    if (
      counters.interruptions > 0
    ) {
      return 'INTERRUPTED';
    }

    if (
      counters.cooldowns > 0
    ) {
      return 'COOLDOWN';
    }

    if (
      counters.supervisorVetoes > 0
    ) {
      return 'VETOED';
    }

    if (
      counters.assistedSuggestions > 0
    ) {
      return 'ASSISTED';
    }

    return 'OBSERVED';
  }

  private auditTrailFor(
    counters: InstitutionalReplayCounters,
    finalState: InstitutionalReplayFinalState,
    integrityScore: number
  ): readonly string[] {
    return Object.freeze([
      `FINAL_STATE:${finalState}`,
      `ROUNDS_OBSERVED:${counters.roundsObserved}`,
      `ASSISTED_SUGGESTIONS:${counters.assistedSuggestions}`,
      `SUPERVISOR_VETOES:${counters.supervisorVetoes}`,
      `COOLDOWNS:${counters.cooldowns}`,
      `INTERRUPTIONS:${counters.interruptions}`,
      `INTEGRITY_SCORE:${this.round(integrityScore)}`,
      'LIVE_MONEY_AUTHORIZATION:FALSE',
      'OPERATIONAL_GATE:BLOCKED'
    ]);
  }

  private assertInput(
    input: InstitutionalReplayInput
  ): void {
    if (
      !Array.isArray(input.events)
    ) {
      throw new Error(
        'INVALID_INSTITUTIONAL_REPLAY_EVENTS'
      );
    }
  }

  private assertEvent(
    event: InstitutionalReplayEvent
  ): void {
    if (
      typeof event.eventId !== 'string' ||
      event.eventId.trim().length === 0
    ) {
      throw new Error(
        'INVALID_INSTITUTIONAL_REPLAY_EVENT_ID'
      );
    }

    if (
      !Number.isFinite(event.timestamp) ||
      event.timestamp < 0
    ) {
      throw new Error(
        'INVALID_INSTITUTIONAL_REPLAY_TIMESTAMP'
      );
    }
  }

  private resolveId(
    value: string | undefined,
    fallback: string
  ): string {
    if (
      typeof value === 'string' &&
      value.trim().length > 0
    ) {
      return value.trim();
    }

    return fallback;
  }

  private normalizeRiskPressure(
    value: number | undefined
  ): number {
    if (
      typeof value !== 'number' ||
      !Number.isFinite(value)
    ) {
      return 0;
    }

    return this.clamp(
      value,
      0,
      100
    );
  }

  private clamp(
    value: number,
    minimum: number,
    maximum: number
  ): number {
    return Math.min(
      maximum,
      Math.max(minimum, value)
    );
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
