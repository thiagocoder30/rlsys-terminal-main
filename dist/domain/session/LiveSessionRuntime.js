"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LiveSessionRuntime = void 0;
const crypto_1 = __importDefault(require("crypto"));
const Result_1 = require("../shared/Result");
const LiveSessionStateMachine_1 = require("./LiveSessionStateMachine");
const ROULETTE_VALUES = 37;
/**
 * Live session runtime responsible for deterministic round-by-round state updates.
 *
 * The runtime is domain-only and framework agnostic. It keeps bounded in-memory
 * windows and an idempotency cache to make repeated event delivery safe. Each
 * accepted round is O(1) amortized for ingestion and O(k) for snapshot metrics,
 * where k is the fixed rolling window size, preserving mobile-device safety.
 */
class LiveSessionRuntime {
    constructor(options = {}) {
        this.sessions = new Map();
        this.warmupSize = Math.max(20, Math.trunc(options.warmupSize ?? 100));
        this.maxHistorySize = Math.max(this.warmupSize, Math.trunc(options.maxHistorySize ?? 240));
        this.maxEventIdCacheSize = Math.max(this.maxHistorySize, Math.trunc(options.maxEventIdCacheSize ?? 512));
        this.decisionWindowSize = Math.max(this.warmupSize, Math.min(this.maxHistorySize, Math.trunc(options.decisionWindowSize ?? 120)));
        this.stateMachine = new LiveSessionStateMachine_1.LiveSessionStateMachine({ warmupSize: this.warmupSize, decisionWindowSize: this.warmupSize });
    }
    ingest(command) {
        const validation = this.validateCommand(command);
        if (validation.length > 0) {
            const sessionId = typeof command.sessionId === 'string' && command.sessionId.trim().length > 0 ? command.sessionId.trim() : 'invalid-session';
            const state = this.getOrCreateSession(sessionId);
            state.rejectedEvents += 1;
            state.status = 'BLOCKED';
            state.updatedAt = new Date().toISOString();
            return (0, Result_1.err)(new Result_1.DomainError(validation.join('; '), 'LIVE_SESSION_INVALID_ROUND'));
        }
        const sessionId = command.sessionId.trim();
        const state = this.getOrCreateSession(sessionId);
        const idempotencyKey = this.idempotencyKey(command);
        if (state.eventIds.has(idempotencyKey)) {
            state.duplicateEvents += 1;
            state.updatedAt = new Date().toISOString();
            return (0, Result_1.ok)({
                status: 'DUPLICATE_IGNORED',
                reason: 'Round event already processed for this session.',
                idempotencyKey,
                snapshot: this.snapshot(state)
            });
        }
        this.trackEventId(state, idempotencyKey);
        state.values.push(command.value);
        if (state.values.length > this.maxHistorySize)
            state.values.shift();
        state.lastSequence = Number.isInteger(command.sequence) ? command.sequence : state.lastSequence;
        state.acceptedEvents += 1;
        state.status = this.statusFor(state.values.length);
        state.updatedAt = command.occurredAt ?? new Date().toISOString();
        return (0, Result_1.ok)({ status: 'ACCEPTED', idempotencyKey, snapshot: this.snapshot(state) });
    }
    snapshotBySession(sessionId) {
        const key = sessionId.trim();
        if (!key)
            return (0, Result_1.err)(new Result_1.DomainError('Session id is required.', 'LIVE_SESSION_ID_REQUIRED'));
        const state = this.sessions.get(key);
        if (!state)
            return (0, Result_1.err)(new Result_1.DomainError('Live session not found.', 'LIVE_SESSION_NOT_FOUND'));
        return (0, Result_1.ok)(this.snapshot(state));
    }
    reset(sessionId) {
        const key = sessionId.trim();
        if (!key)
            return (0, Result_1.err)(new Result_1.DomainError('Session id is required.', 'LIVE_SESSION_ID_REQUIRED'));
        const state = this.createSession(key);
        this.sessions.set(key, state);
        return (0, Result_1.ok)(this.snapshot(state));
    }
    validateCommand(command) {
        const errors = [];
        if (!command || typeof command !== 'object')
            errors.push('Round command is required.');
        if (typeof command.sessionId !== 'string' || command.sessionId.trim().length === 0)
            errors.push('sessionId is required.');
        if (!Number.isInteger(command.value) || command.value < 0 || command.value > 36)
            errors.push(`Invalid roulette value: ${command.value}`);
        if (command.sequence !== undefined && (!Number.isInteger(command.sequence) || command.sequence < 0))
            errors.push('sequence must be a non-negative integer.');
        return errors;
    }
    getOrCreateSession(sessionId) {
        const existing = this.sessions.get(sessionId);
        if (existing)
            return existing;
        const created = this.createSession(sessionId);
        this.sessions.set(sessionId, created);
        return created;
    }
    createSession(sessionId) {
        return {
            sessionId,
            status: 'INITIALIZING',
            values: [],
            eventIds: new Set(),
            eventIdQueue: [],
            acceptedEvents: 0,
            duplicateEvents: 0,
            rejectedEvents: 0,
            updatedAt: new Date().toISOString()
        };
    }
    statusFor(windowSize) {
        if (windowSize < this.warmupSize)
            return 'INITIALIZING';
        if (windowSize < this.decisionWindowSize)
            return 'WARMED_UP';
        return 'LIVE_READY';
    }
    trackEventId(state, idempotencyKey) {
        state.eventIds.add(idempotencyKey);
        state.eventIdQueue.push(idempotencyKey);
        while (state.eventIdQueue.length > this.maxEventIdCacheSize) {
            const oldest = state.eventIdQueue.shift();
            if (oldest)
                state.eventIds.delete(oldest);
        }
    }
    idempotencyKey(command) {
        if (command.eventId && command.eventId.trim().length > 0)
            return command.eventId.trim();
        const source = `${command.sessionId.trim()}|${command.sequence ?? 'no-seq'}|${command.value}|${command.occurredAt ?? 'no-time'}`;
        return crypto_1.default.createHash('sha256').update(source).digest('hex').slice(0, 24);
    }
    snapshot(state) {
        const historyWindow = state.values.slice(-this.maxHistorySize);
        const warmupWindow = state.values.slice(-this.warmupSize);
        const rollingWindow = state.values.slice(-Math.min(32, state.values.length));
        const rolling = this.rollingMetrics(rollingWindow);
        const control = this.stateMachine.evaluate({ status: state.status, roundCount: state.values.length, rolling });
        const checksum = crypto_1.default.createHash('sha256').update(historyWindow.join(',')).digest('hex');
        return {
            engineVersion: 'live-session-runtime-v1',
            sessionId: state.sessionId,
            status: state.status,
            roundCount: state.values.length,
            acceptedEvents: state.acceptedEvents,
            duplicateEvents: state.duplicateEvents,
            rejectedEvents: state.rejectedEvents,
            lastValue: state.values[state.values.length - 1],
            lastSequence: state.lastSequence,
            warmupProgress: this.round(Math.min(1, state.values.length / this.warmupSize)),
            readyForDecision: state.values.length >= this.warmupSize && state.status !== 'BLOCKED',
            historyWindow,
            warmupWindow,
            rolling,
            control,
            checksum,
            updatedAt: state.updatedAt
        };
    }
    rollingMetrics(values) {
        if (values.length === 0) {
            return { windowSize: 0, uniqueNumbers: 0, normalizedEntropy: 0, repeatRate: 0, maxNumberConcentration: 0, alternationRate: 0 };
        }
        const counts = new Array(ROULETTE_VALUES).fill(0);
        let repeats = 0;
        let alternations = 0;
        for (let index = 0; index < values.length; index += 1) {
            const value = values[index];
            counts[value] += 1;
            if (index > 0) {
                if (value === values[index - 1])
                    repeats += 1;
                else
                    alternations += 1;
            }
        }
        const entropy = this.entropy(counts, values.length);
        return {
            windowSize: values.length,
            uniqueNumbers: counts.filter(count => count > 0).length,
            normalizedEntropy: this.round(entropy / Math.log2(ROULETTE_VALUES)),
            repeatRate: this.round(values.length <= 1 ? 0 : repeats / (values.length - 1)),
            maxNumberConcentration: this.round(Math.max(...counts) / values.length),
            alternationRate: this.round(values.length <= 1 ? 0 : alternations / (values.length - 1))
        };
    }
    entropy(counts, total) {
        let entropy = 0;
        for (const count of counts) {
            if (count === 0)
                continue;
            const probability = count / total;
            entropy -= probability * Math.log2(probability);
        }
        return entropy;
    }
    round(value) {
        return Number.isFinite(value) ? Number(value.toFixed(6)) : 0;
    }
}
exports.LiveSessionRuntime = LiveSessionRuntime;
