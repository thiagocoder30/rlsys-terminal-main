import crypto from 'crypto';
import { DomainError, err, ok, Result } from '../shared/Result';

export type DomainEventTopic =
  | 'session.round.ingested'
  | 'statistics.snapshot.updated'
  | 'decision.requested'
  | 'decision.completed'
  | 'persistence.snapshot.requested'
  | 'persistence.snapshot.completed'
  | 'risk.cooldown.entered'
  | 'system.audit.recorded';

export type DomainEventPriority = 'LOW' | 'NORMAL' | 'HIGH';
export type DomainEventDeliveryStatus = 'DELIVERED' | 'DUPLICATE_IGNORED' | 'REJECTED';

export interface DomainEventPayload {
  readonly [key: string]: string | number | boolean | null | readonly string[] | readonly number[] | DomainEventPayload | readonly DomainEventPayload[];
}

export interface DomainEventEnvelope<TPayload extends DomainEventPayload = DomainEventPayload> {
  readonly topic: DomainEventTopic;
  readonly eventId: string;
  readonly occurredAtSpin: number;
  readonly priority: DomainEventPriority;
  readonly payload: TPayload;
}

export interface DomainEventReceipt {
  readonly observerId: string;
  readonly accepted: boolean;
  readonly reason?: string;
}

export interface DomainEventPublishReport {
  readonly status: DomainEventDeliveryStatus;
  readonly topic: DomainEventTopic;
  readonly eventId: string;
  readonly deliveredObservers: number;
  readonly failedObservers: number;
  readonly duplicateEvents: number;
  readonly receipts: readonly DomainEventReceipt[];
  readonly checksum: string;
}

export interface DomainEventBusSnapshot {
  readonly engineVersion: 'internal-event-bus-v1';
  readonly registeredObservers: number;
  readonly topics: readonly DomainEventTopic[];
  readonly totalPublished: number;
  readonly totalDelivered: number;
  readonly totalObserverFailures: number;
  readonly duplicateEvents: number;
  readonly idempotencyCacheSize: number;
  readonly checksum: string;
}

export interface DomainEventBusOptions {
  readonly idempotencyCacheSize?: number;
  readonly maxObserversPerTopic?: number;
}

export interface DomainEventObserver<TPayload extends DomainEventPayload = DomainEventPayload> {
  readonly id: string;
  readonly topic: DomainEventTopic;
  handle(event: DomainEventEnvelope<TPayload>): Result<DomainEventReceipt, DomainError>;
}

export interface DomainEventSubscription {
  readonly observerId: string;
  readonly topic: DomainEventTopic;
  readonly active: boolean;
}

interface RegisteredObserver {
  readonly id: string;
  readonly topic: DomainEventTopic;
  readonly handle: (event: DomainEventEnvelope) => Result<DomainEventReceipt, DomainError>;
}

const DEFAULT_IDEMPOTENCY_CACHE_SIZE = 512;
const DEFAULT_MAX_OBSERVERS_PER_TOPIC = 100;
const TOPIC_ORDER: readonly DomainEventTopic[] = [
  'session.round.ingested',
  'statistics.snapshot.updated',
  'decision.requested',
  'decision.completed',
  'persistence.snapshot.requested',
  'persistence.snapshot.completed',
  'risk.cooldown.entered',
  'system.audit.recorded'
];

/**
 * Synchronous in-process event bus for RL.SYS domain modules.
 *
 * The bus implements the Observer pattern without depending on HTTP,
 * filesystem, database, timers or framework details. Delivery is bounded and
 * deterministic: observers are called in subscription order, duplicate events
 * are ignored through a fixed idempotency cache and observer failures are
 * reported as Result metadata instead of being thrown through the runtime.
 *
 * Complexity:
 * - subscribe/unsubscribe: O(1) expected map/set operations
 * - publish: O(k), where k is observers registered for the topic
 * - snapshot: O(t), where t is the fixed topic count
 */
export class InternalEventBus {
  private readonly idempotencyCacheSize: number;
  private readonly maxObserversPerTopic: number;
  private readonly observersByTopic = new Map<DomainEventTopic, RegisteredObserver[]>();
  private readonly observerIndex = new Map<string, DomainEventTopic>();
  private readonly eventIds = new Set<string>();
  private readonly eventQueue: string[] = [];
  private totalPublished = 0;
  private totalDelivered = 0;
  private totalObserverFailures = 0;
  private duplicateEvents = 0;

  constructor(options: DomainEventBusOptions = {}) {
    this.idempotencyCacheSize = Math.max(32, Math.trunc(options.idempotencyCacheSize ?? DEFAULT_IDEMPOTENCY_CACHE_SIZE));
    this.maxObserversPerTopic = Math.max(1, Math.trunc(options.maxObserversPerTopic ?? DEFAULT_MAX_OBSERVERS_PER_TOPIC));
    for (const topic of TOPIC_ORDER) this.observersByTopic.set(topic, []);
  }

  public subscribe<TPayload extends DomainEventPayload>(observer: DomainEventObserver<TPayload>): Result<DomainEventSubscription, DomainError> {
    const validation = this.validateObserver(observer);
    if (validation.length > 0) return err(new DomainError(validation.join('; '), 'EVENT_BUS_INVALID_OBSERVER'));

    if (this.observerIndex.has(observer.id)) {
      return err(new DomainError(`observer already registered: ${observer.id}`, 'EVENT_BUS_DUPLICATE_OBSERVER'));
    }

    const observers = this.observersByTopic.get(observer.topic) ?? [];
    if (observers.length >= this.maxObserversPerTopic) {
      return err(new DomainError(`observer limit reached for topic ${observer.topic}`, 'EVENT_BUS_TOPIC_CAPACITY_EXCEEDED'));
    }

    const registered: RegisteredObserver = {
      id: observer.id,
      topic: observer.topic,
      handle: (event: DomainEventEnvelope) => observer.handle(event as DomainEventEnvelope<TPayload>)
    };

    observers.push(registered);
    this.observersByTopic.set(observer.topic, observers);
    this.observerIndex.set(observer.id, observer.topic);

    return ok({ observerId: observer.id, topic: observer.topic, active: true });
  }

  public unsubscribe(observerId: string): Result<DomainEventSubscription, DomainError> {
    if (typeof observerId !== 'string' || observerId.trim().length === 0) {
      return err(new DomainError('observerId must be a non-empty string', 'EVENT_BUS_INVALID_OBSERVER_ID'));
    }

    const topic = this.observerIndex.get(observerId);
    if (!topic) {
      return ok({ observerId, topic: 'system.audit.recorded', active: false });
    }

    const observers = this.observersByTopic.get(topic) ?? [];
    this.observersByTopic.set(topic, observers.filter((observer) => observer.id !== observerId));
    this.observerIndex.delete(observerId);
    return ok({ observerId, topic, active: false });
  }

  public publish<TPayload extends DomainEventPayload>(event: DomainEventEnvelope<TPayload>): Result<DomainEventPublishReport, DomainError> {
    const validation = this.validateEvent(event);
    if (validation.length > 0) return err(new DomainError(validation.join('; '), 'EVENT_BUS_INVALID_EVENT'));

    if (this.eventIds.has(event.eventId)) {
      this.duplicateEvents += 1;
      return ok(this.createReport(event, 'DUPLICATE_IGNORED', [], 0, 0));
    }

    this.trackEventId(event.eventId);
    this.totalPublished += 1;

    const observers = this.observersByTopic.get(event.topic) ?? [];
    const receipts: DomainEventReceipt[] = [];
    let delivered = 0;
    let failed = 0;

    for (const observer of observers) {
      const receipt = observer.handle(event as DomainEventEnvelope);
      if (receipt.success && receipt.value.accepted) {
        delivered += 1;
        receipts.push({ observerId: observer.id, accepted: true, reason: receipt.value.reason });
      } else if (receipt.success) {
        failed += 1;
        receipts.push({ observerId: observer.id, accepted: false, reason: receipt.value.reason ?? 'observer rejected event' });
      } else {
        failed += 1;
        receipts.push({ observerId: observer.id, accepted: false, reason: receipt.error.message });
      }
    }

    this.totalDelivered += delivered;
    this.totalObserverFailures += failed;
    return ok(this.createReport(event, delivered > 0 || observers.length === 0 ? 'DELIVERED' : 'REJECTED', receipts, delivered, failed));
  }

  public snapshot(): DomainEventBusSnapshot {
    const topics = TOPIC_ORDER.filter((topic) => (this.observersByTopic.get(topic) ?? []).length > 0);
    const payload = {
      engineVersion: 'internal-event-bus-v1',
      registeredObservers: this.observerIndex.size,
      topics,
      totalPublished: this.totalPublished,
      totalDelivered: this.totalDelivered,
      totalObserverFailures: this.totalObserverFailures,
      duplicateEvents: this.duplicateEvents,
      idempotencyCacheSize: this.idempotencyCacheSize
    } as const;

    return { ...payload, checksum: this.checksum(payload) };
  }

  private validateObserver(observer: DomainEventObserver): string[] {
    const errors: string[] = [];
    if (!observer || typeof observer !== 'object') errors.push('observer must be an object');
    if (typeof observer?.id !== 'string' || observer.id.trim().length === 0) errors.push('observer.id must be a non-empty string');
    if (!TOPIC_ORDER.includes(observer?.topic)) errors.push('observer.topic is not supported');
    if (typeof observer?.handle !== 'function') errors.push('observer.handle must be a function');
    return errors;
  }

  private validateEvent(event: DomainEventEnvelope): string[] {
    const errors: string[] = [];
    if (!event || typeof event !== 'object') errors.push('event must be an object');
    if (!TOPIC_ORDER.includes(event?.topic)) errors.push('event.topic is not supported');
    if (typeof event?.eventId !== 'string' || event.eventId.trim().length === 0) errors.push('event.eventId must be a non-empty string');
    if (!Number.isInteger(event?.occurredAtSpin) || event.occurredAtSpin < 0) errors.push('event.occurredAtSpin must be a non-negative integer');
    if (!['LOW', 'NORMAL', 'HIGH'].includes(event?.priority)) errors.push('event.priority is not supported');
    if (!event?.payload || typeof event.payload !== 'object' || Array.isArray(event.payload)) errors.push('event.payload must be an object');
    return errors;
  }

  private trackEventId(eventId: string): void {
    this.eventIds.add(eventId);
    this.eventQueue.push(eventId);
    while (this.eventQueue.length > this.idempotencyCacheSize) {
      const expired = this.eventQueue.shift();
      if (expired) this.eventIds.delete(expired);
    }
  }

  private createReport(
    event: DomainEventEnvelope,
    status: DomainEventDeliveryStatus,
    receipts: readonly DomainEventReceipt[],
    deliveredObservers: number,
    failedObservers: number
  ): DomainEventPublishReport {
    const payload = {
      status,
      topic: event.topic,
      eventId: event.eventId,
      deliveredObservers,
      failedObservers,
      duplicateEvents: this.duplicateEvents,
      receipts: [...receipts].sort((a, b) => a.observerId.localeCompare(b.observerId))
    } as const;

    return { ...payload, checksum: this.checksum(payload) };
  }

  private checksum(value: unknown): string {
    return crypto.createHash('sha256').update(this.stableStringify(value)).digest('hex');
  }

  private stableStringify(value: unknown): string {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map((item) => this.stableStringify(item)).join(',')}]`;
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${this.stableStringify(record[key])}`).join(',')}}`;
  }
}
