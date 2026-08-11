interface RuntimeEvent {
  id: string;
  type: string;
  occurredAtEpochMs: number;
  payload?: unknown;
}

interface Listener {
  name: string;
  handle: (event: RuntimeEvent) => Promise<void>;
}

interface PublishResult {
  delivered: number;
  failed: number;
  failures?: Array<{
    listenerName: string;
    message: string;
  }>;
}

export class RuntimeEventBus {
  private readonly listeners: Map<string, Listener> = new Map();
  private readonly processedEventIds: Set<string> = new Set();
  private readonly maxProcessedEventIds: number;

  constructor(options: { maxProcessedEventIds?: number } = {}) {
    this.maxProcessedEventIds = options.maxProcessedEventIds ?? 1000;
  }

  subscribe(listener: Listener): void {
    if (!listener.name?.trim()) {
      throw new Error('listener name must be provided');
    }
    this.listeners.set(listener.name, listener);
  }

  unsubscribe(listenerName: string): boolean {
    return this.listeners.delete(listenerName);
  }

  async dispatchSignal(
    id: string,
    targetSector: number,
    confidence: number,
    strategyId: string
  ): Promise<PublishResult> {
    return this.publish({
      id,
      type: "SIGNAL",
      occurredAtEpochMs: Date.now(),
      payload: {
        targetSector,
        confidence,
        strategyId
      }
    });
  }

  async publish(event: RuntimeEvent): Promise<PublishResult> {
    if (!event?.id?.trim()) {
      throw new Error('event id is required');
    }
    if (typeof event.occurredAtEpochMs !== 'number' || 
        Number.isNaN(event.occurredAtEpochMs) || 
        event.occurredAtEpochMs <= 0) {
      throw new Error('invalid occurredAtEpochMs');
    }

    if (this.processedEventIds.has(event.id)) {
      return { delivered: 0, failed: 0 };
    }

    // Manage memory of processed events
    if (this.processedEventIds.size >= this.maxProcessedEventIds) {
      const oldest = this.processedEventIds.values().next().value;
      if (oldest) {
        this.processedEventIds.delete(oldest);
      }
    }
    this.processedEventIds.add(event.id);

    const result: PublishResult = {
      delivered: 0,
      failed: 0,
      failures: []
    };

    for (const [listenerName, listener] of this.listeners) {
      try {
        await listener.handle(event);
        result.delivered++;
      } catch (error) {
        result.failed++;
        result.failures?.push({
          listenerName,
          message: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return result;
  }

  listenerCount(): number {
    return this.listeners.size;
  }
}
