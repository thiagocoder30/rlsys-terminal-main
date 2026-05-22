export type RuntimeEventType =
  | "RUNTIME_BOOTED"
  | "COMMAND_RECEIVED"
  | "COMMAND_HANDLED"
  | "CHECKPOINT_SAVED"
  | "HUD_RENDERED"
  | "REPORT_GENERATED"
  | "SESSION_FINISHED"
  | "RUNTIME_FAULT";

export interface RuntimeEventPayload {
  readonly [key: string]: string | number | boolean | null | undefined;
}

export interface RuntimeEvent {
  readonly id: string;
  readonly type: RuntimeEventType;
  readonly occurredAtEpochMs: number;
  readonly payload: RuntimeEventPayload;
}

export interface RuntimeEventListener {
  readonly name: string;
  handle(event: RuntimeEvent): Promise<void>;
}

export interface RuntimeEventPublishResult {
  readonly eventId: string;
  readonly delivered: number;
  readonly failed: number;
  readonly failures: readonly RuntimeEventListenerFailure[];
}

export interface RuntimeEventListenerFailure {
  readonly listenerName: string;
  readonly message: string;
}

/**
 * Lightweight internal event bus for runtime hardening.
 *
 * Design goals:
 * - no framework dependency;
 * - listener isolation;
 * - idempotent event publication by event id;
 * - bounded processed-event memory;
 * - safe fan-out for telemetry, replay, audit and checkpoint listeners.
 *
 * Complexity:
 * - publish: O(n), where n is listener count.
 * - subscribe/unsubscribe: O(1) average.
 * - memory: O(l + e), listeners + bounded processed event ids.
 */
export class RuntimeEventBus {
  private readonly listeners: Map<string, RuntimeEventListener> = new Map<string, RuntimeEventListener>();
  private readonly processedEventIds: Set<string> = new Set<string>();
  private readonly maxProcessedEventIds: number;

  public constructor(options: { readonly maxProcessedEventIds?: number } = {}) {
    this.maxProcessedEventIds = options.maxProcessedEventIds ?? 1024;
  }

  public subscribe(listener: RuntimeEventListener): void {
    if (listener.name.trim().length === 0) {
      throw new Error("Runtime event listener name cannot be empty.");
    }

    this.listeners.set(listener.name, listener);
  }

  public unsubscribe(listenerName: string): boolean {
    return this.listeners.delete(listenerName);
  }

  public listenerCount(): number {
    return this.listeners.size;
  }

  public async publish(event: RuntimeEvent): Promise<RuntimeEventPublishResult> {
    this.validateEvent(event);

    if (this.processedEventIds.has(event.id)) {
      return {
        eventId: event.id,
        delivered: 0,
        failed: 0,
        failures: [],
      };
    }

    const failures: RuntimeEventListenerFailure[] = [];
    let delivered = 0;

    for (const listener of this.listeners.values()) {
      try {
        await listener.handle(event);
        delivered += 1;
      } catch (error: unknown) {
        failures.push({
          listenerName: listener.name,
          message: this.describeError(error),
        });
      }
    }

    this.rememberEvent(event.id);

    return {
      eventId: event.id,
      delivered,
      failed: failures.length,
      failures,
    };
  }

  private validateEvent(event: RuntimeEvent): void {
    if (event.id.trim().length === 0) {
      throw new Error("Runtime event id cannot be empty.");
    }

    if (!Number.isFinite(event.occurredAtEpochMs) || event.occurredAtEpochMs <= 0) {
      throw new Error("Runtime event occurredAtEpochMs must be positive and finite.");
    }
  }

  private rememberEvent(eventId: string): void {
    this.processedEventIds.add(eventId);

    if (this.processedEventIds.size <= this.maxProcessedEventIds) {
      return;
    }

    const compacted = Array.from(this.processedEventIds).slice(
      this.processedEventIds.size - this.maxProcessedEventIds,
    );

    this.processedEventIds.clear();

    for (const id of compacted) {
      this.processedEventIds.add(id);
    }
  }

  private describeError(error: unknown): string {
    if (error instanceof Error && error.message.length > 0) {
      return error.message;
    }

    return "Unknown runtime event listener failure.";
  }
}
