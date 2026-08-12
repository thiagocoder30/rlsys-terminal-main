export interface RuntimeEvent {
  readonly id: string;
  readonly type: string;
  readonly occurredAtEpochMs: number;
  readonly payload?: unknown;
}

export interface RuntimeEventListener {
  readonly name: string;
  readonly handle: (event: RuntimeEvent) => Promise<void>;
}

export interface RuntimeEventFailure {
  readonly listenerName: string;
  readonly message: string;
}

export interface RuntimeEventPublishResult {
  readonly delivered: number;
  readonly failed: number;
  readonly failures: readonly RuntimeEventFailure[];
}

export interface RuntimeEventBusOptions {
  readonly maxProcessedEventIds?: number;
}

/**
 * Runtime-level asynchronous event bus.
 *
 * Responsibilities:
 * - named runtime listeners;
 * - isolated listener failures;
 * - bounded event-id idempotency;
 * - generic runtime event publication;
 * - compatibility adapter for legacy dispatchSignal callers.
 *
 * This is intentionally separate from domain/events/InternalEventBus,
 * which remains the deterministic synchronous domain event bus.
 */
export class RuntimeEventBus {
  private readonly listeners = new Map<string, RuntimeEventListener>();
  private readonly processedEventIds = new Set<string>();
  private readonly maxProcessedEventIds: number;

  /**
   * The numeric form is retained for compatibility with the original
   * `new RuntimeEventBus(250)` call sites.
   */
  public constructor(options: RuntimeEventBusOptions | number = {}) {
    const configuredLimit =
      typeof options === 'number'
        ? options
        : options.maxProcessedEventIds ?? 1000;

    if (!Number.isFinite(configuredLimit) || configuredLimit < 1) {
      throw new Error('maxProcessedEventIds must be a positive number');
    }

    this.maxProcessedEventIds = Math.max(1, Math.trunc(configuredLimit));
  }

  public subscribe(listener: RuntimeEventListener): void {
    if (!listener?.name?.trim()) {
      throw new Error('listener name must be provided');
    }

    if (typeof listener.handle !== 'function') {
      throw new Error('listener handle must be provided');
    }

    this.listeners.set(listener.name, listener);
  }

  public unsubscribe(listenerName: string): boolean {
    return this.listeners.delete(listenerName);
  }

  public listenerCount(): number {
    return this.listeners.size;
  }

  /**
   * Legacy telemetry alias retained during canonical migration.
   */
  public getActiveSubscribersCount(): number {
    return this.listenerCount();
  }

  /**
   * Compatibility adapter for the original quantitative signal callers.
   */
  public async dispatchSignal(
    id: string,
    targetSector: number,
    confidence: number,
    strategyId: string
  ): Promise<RuntimeEventPublishResult> {
    return this.publish({
      id,
      type: 'SIGNAL',
      occurredAtEpochMs: Date.now(),
      payload: {
        targetSector,
        confidence,
        strategyId
      }
    });
  }

  public async publish(
    event: RuntimeEvent
  ): Promise<RuntimeEventPublishResult> {
    this.validateEvent(event);

    if (this.processedEventIds.has(event.id)) {
      return {
        delivered: 0,
        failed: 0,
        failures: []
      };
    }

    this.trackProcessedEventId(event.id);

    let delivered = 0;
    let failed = 0;
    const failures: RuntimeEventFailure[] = [];

    for (const [listenerName, listener] of this.listeners) {
      try {
        await listener.handle(event);
        delivered += 1;
      } catch (error) {
        failed += 1;

        failures.push({
          listenerName,
          message: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return {
      delivered,
      failed,
      failures
    };
  }

  private validateEvent(event: RuntimeEvent): void {
    if (!event || typeof event !== 'object') {
      throw new Error('runtime event must be provided');
    }

    if (typeof event.id !== 'string' || event.id.trim().length === 0) {
      throw new Error('event id is required');
    }

    if (
      typeof event.occurredAtEpochMs !== 'number' ||
      !Number.isFinite(event.occurredAtEpochMs) ||
      event.occurredAtEpochMs <= 0
    ) {
      throw new Error('invalid occurredAtEpochMs');
    }

    if (typeof event.type !== 'string' || event.type.trim().length === 0) {
      throw new Error('event type is required');
    }
  }

  private trackProcessedEventId(eventId: string): void {
    while (this.processedEventIds.size >= this.maxProcessedEventIds) {
      const oldest = this.processedEventIds.values().next().value as
        | string
        | undefined;

      if (oldest === undefined) {
        break;
      }

      this.processedEventIds.delete(oldest);
    }

    this.processedEventIds.add(eventId);
  }
}
