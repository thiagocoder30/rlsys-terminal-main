import { randomUUID } from 'crypto';
import { RuntimeEvent } from './RuntimeEvent';

export type EventHandler = (event: RuntimeEvent) => void;

export class ObservabilityEventBus {
    private readonly handlers: Map<string, EventHandler[]> = new Map();
    private readonly allHandlers: EventHandler[] = [];
    private readonly history: RuntimeEvent[] = [];
    private readonly MAX_HISTORY = 5000;

    public subscribe(eventType: string, handler: EventHandler): void {
        const current = this.handlers.get(eventType) || [];
        current.push(handler);
        this.handlers.set(eventType, current);
    }

    public subscribeAll(handler: EventHandler): void {
        this.allHandlers.push(handler);
    }

    public publish(
        eventType: string,
        runtimeVersion: string,
        correlationId: string,
        sessionId?: string,
        payload?: Record<string, unknown>
    ): void {
        const event: RuntimeEvent = Object.freeze({
            eventId: randomUUID(),
            eventType,
            timestampUtc: new Date().toISOString(),
            runtimeVersion,
            correlationId,
            sessionId,
            payload
        });

        this.history.push(event);
        if (this.history.length > this.MAX_HISTORY) {
            this.history.shift();
        }

        const typeHandlers = this.handlers.get(eventType) || [];
        for (const handler of typeHandlers) {
            try {
                handler(event);
            } catch (error) {
                console.error(`[ObservabilityEventBus] Error in handler for ${eventType}:`, error);
            }
        }

        for (const handler of this.allHandlers) {
            try {
                handler(event);
            } catch (error) {
                console.error(`[ObservabilityEventBus] Error in global handler for ${eventType}:`, error);
            }
        }
    }

    public getEvents(limit: number = 100): ReadonlyArray<RuntimeEvent> {
        return this.history.slice(-limit);
    }
}
