export interface RuntimeEvent {
    readonly eventId: string;
    readonly eventType: string;
    readonly timestampUtc: string;
    readonly runtimeVersion: string;
    readonly correlationId: string;
    readonly sessionId?: string;
    readonly payload?: Record<string, unknown>;
}
