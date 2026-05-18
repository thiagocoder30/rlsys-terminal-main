"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InternalEventBus = void 0;
const crypto_1 = __importDefault(require("crypto"));
const Result_1 = require("../shared/Result");
const DEFAULT_IDEMPOTENCY_CACHE_SIZE = 512;
const DEFAULT_MAX_OBSERVERS_PER_TOPIC = 100;
const TOPIC_ORDER = [
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
class InternalEventBus {
    constructor(options = {}) {
        this.observersByTopic = new Map();
        this.observerIndex = new Map();
        this.eventIds = new Set();
        this.eventQueue = [];
        this.totalPublished = 0;
        this.totalDelivered = 0;
        this.totalObserverFailures = 0;
        this.duplicateEvents = 0;
        this.idempotencyCacheSize = Math.max(32, Math.trunc(options.idempotencyCacheSize ?? DEFAULT_IDEMPOTENCY_CACHE_SIZE));
        this.maxObserversPerTopic = Math.max(1, Math.trunc(options.maxObserversPerTopic ?? DEFAULT_MAX_OBSERVERS_PER_TOPIC));
        for (const topic of TOPIC_ORDER)
            this.observersByTopic.set(topic, []);
    }
    subscribe(observer) {
        const validation = this.validateObserver(observer);
        if (validation.length > 0)
            return (0, Result_1.err)(new Result_1.DomainError(validation.join('; '), 'EVENT_BUS_INVALID_OBSERVER'));
        if (this.observerIndex.has(observer.id)) {
            return (0, Result_1.err)(new Result_1.DomainError(`observer already registered: ${observer.id}`, 'EVENT_BUS_DUPLICATE_OBSERVER'));
        }
        const observers = this.observersByTopic.get(observer.topic) ?? [];
        if (observers.length >= this.maxObserversPerTopic) {
            return (0, Result_1.err)(new Result_1.DomainError(`observer limit reached for topic ${observer.topic}`, 'EVENT_BUS_TOPIC_CAPACITY_EXCEEDED'));
        }
        const registered = {
            id: observer.id,
            topic: observer.topic,
            handle: (event) => observer.handle(event)
        };
        observers.push(registered);
        this.observersByTopic.set(observer.topic, observers);
        this.observerIndex.set(observer.id, observer.topic);
        return (0, Result_1.ok)({ observerId: observer.id, topic: observer.topic, active: true });
    }
    unsubscribe(observerId) {
        if (typeof observerId !== 'string' || observerId.trim().length === 0) {
            return (0, Result_1.err)(new Result_1.DomainError('observerId must be a non-empty string', 'EVENT_BUS_INVALID_OBSERVER_ID'));
        }
        const topic = this.observerIndex.get(observerId);
        if (!topic) {
            return (0, Result_1.ok)({ observerId, topic: 'system.audit.recorded', active: false });
        }
        const observers = this.observersByTopic.get(topic) ?? [];
        this.observersByTopic.set(topic, observers.filter((observer) => observer.id !== observerId));
        this.observerIndex.delete(observerId);
        return (0, Result_1.ok)({ observerId, topic, active: false });
    }
    publish(event) {
        const validation = this.validateEvent(event);
        if (validation.length > 0)
            return (0, Result_1.err)(new Result_1.DomainError(validation.join('; '), 'EVENT_BUS_INVALID_EVENT'));
        if (this.eventIds.has(event.eventId)) {
            this.duplicateEvents += 1;
            return (0, Result_1.ok)(this.createReport(event, 'DUPLICATE_IGNORED', [], 0, 0));
        }
        this.trackEventId(event.eventId);
        this.totalPublished += 1;
        const observers = this.observersByTopic.get(event.topic) ?? [];
        const receipts = [];
        let delivered = 0;
        let failed = 0;
        for (const observer of observers) {
            const receipt = observer.handle(event);
            if (receipt.success && receipt.value.accepted) {
                delivered += 1;
                receipts.push({ observerId: observer.id, accepted: true, reason: receipt.value.reason });
            }
            else if (receipt.success) {
                failed += 1;
                receipts.push({ observerId: observer.id, accepted: false, reason: receipt.value.reason ?? 'observer rejected event' });
            }
            else {
                failed += 1;
                receipts.push({ observerId: observer.id, accepted: false, reason: receipt.error.message });
            }
        }
        this.totalDelivered += delivered;
        this.totalObserverFailures += failed;
        return (0, Result_1.ok)(this.createReport(event, delivered > 0 || observers.length === 0 ? 'DELIVERED' : 'REJECTED', receipts, delivered, failed));
    }
    snapshot() {
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
        };
        return { ...payload, checksum: this.checksum(payload) };
    }
    validateObserver(observer) {
        const errors = [];
        if (!observer || typeof observer !== 'object')
            errors.push('observer must be an object');
        if (typeof observer?.id !== 'string' || observer.id.trim().length === 0)
            errors.push('observer.id must be a non-empty string');
        if (!TOPIC_ORDER.includes(observer?.topic))
            errors.push('observer.topic is not supported');
        if (typeof observer?.handle !== 'function')
            errors.push('observer.handle must be a function');
        return errors;
    }
    validateEvent(event) {
        const errors = [];
        if (!event || typeof event !== 'object')
            errors.push('event must be an object');
        if (!TOPIC_ORDER.includes(event?.topic))
            errors.push('event.topic is not supported');
        if (typeof event?.eventId !== 'string' || event.eventId.trim().length === 0)
            errors.push('event.eventId must be a non-empty string');
        if (!Number.isInteger(event?.occurredAtSpin) || event.occurredAtSpin < 0)
            errors.push('event.occurredAtSpin must be a non-negative integer');
        if (!['LOW', 'NORMAL', 'HIGH'].includes(event?.priority))
            errors.push('event.priority is not supported');
        if (!event?.payload || typeof event.payload !== 'object' || Array.isArray(event.payload))
            errors.push('event.payload must be an object');
        return errors;
    }
    trackEventId(eventId) {
        this.eventIds.add(eventId);
        this.eventQueue.push(eventId);
        while (this.eventQueue.length > this.idempotencyCacheSize) {
            const expired = this.eventQueue.shift();
            if (expired)
                this.eventIds.delete(expired);
        }
    }
    createReport(event, status, receipts, deliveredObservers, failedObservers) {
        const payload = {
            status,
            topic: event.topic,
            eventId: event.eventId,
            deliveredObservers,
            failedObservers,
            duplicateEvents: this.duplicateEvents,
            receipts: [...receipts].sort((a, b) => a.observerId.localeCompare(b.observerId))
        };
        return { ...payload, checksum: this.checksum(payload) };
    }
    checksum(value) {
        return crypto_1.default.createHash('sha256').update(this.stableStringify(value)).digest('hex');
    }
    stableStringify(value) {
        if (value === null || typeof value !== 'object')
            return JSON.stringify(value);
        if (Array.isArray(value))
            return `[${value.map((item) => this.stableStringify(item)).join(',')}]`;
        const record = value;
        return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${this.stableStringify(record[key])}`).join(',')}}`;
    }
}
exports.InternalEventBus = InternalEventBus;
