"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionPersistenceEngine = void 0;
const crypto_1 = __importDefault(require("crypto"));
const Result_1 = require("../shared/Result");
const LiveSessionRuntime_1 = require("./LiveSessionRuntime");
/**
 * Builds deterministic persistence envelopes for live sessions and restores them
 * through replay without binding the domain to filesystem, database or network IO.
 *
 * Complexity:
 * - createRecord: O(n) time and O(n) memory over the bounded journal.
 * - recoverFromRecord: O(n) time and O(1) additional runtime state besides the
 *   bounded LiveSessionRuntime windows.
 */
class SessionPersistenceEngine {
    constructor(options = {}) {
        this.runtimeOptions = options;
        this.maxJournalEntries = Math.max(1, Math.trunc(options.maxJournalEntries ?? 512));
    }
    createRecord(snapshot, journal = [], persistedAt = new Date().toISOString()) {
        try {
            const snapshotErrors = this.validateSnapshot(snapshot);
            const journalErrors = this.validateJournal(snapshot.sessionId, journal);
            if (snapshotErrors.length > 0 || journalErrors.length > 0) {
                return (0, Result_1.err)(new Result_1.DomainError([...snapshotErrors, ...journalErrors].join('; '), 'SESSION_PERSISTENCE_INVALID_RECORD_INPUT'));
            }
            const boundedJournal = journal.slice(-this.maxJournalEntries);
            const snapshotChecksum = this.snapshotChecksum(snapshot);
            const journalChecksum = this.journalChecksum(boundedJournal);
            const recordChecksum = this.recordChecksum(snapshot.sessionId, snapshotChecksum, journalChecksum, persistedAt);
            return (0, Result_1.ok)({
                schemaVersion: 'session-persistence-v1',
                sessionId: snapshot.sessionId,
                snapshot,
                journal: boundedJournal,
                journalChecksum,
                snapshotChecksum,
                recordChecksum,
                persistedAt
            });
        }
        catch (error) {
            return (0, Result_1.err)(new Result_1.DomainError(`Session persistence record creation failed: ${error.message}`, 'SESSION_PERSISTENCE_CREATE_FAILED'));
        }
    }
    verifyRecord(record) {
        try {
            const blockers = this.validateRecord(record);
            if (blockers.length > 0) {
                return (0, Result_1.err)(new Result_1.DomainError(blockers.join('; '), 'SESSION_PERSISTENCE_RECORD_CORRUPTED'));
            }
            return (0, Result_1.ok)({
                engineVersion: 'session-persistence-engine-v1',
                status: 'VALID',
                sessionId: record.sessionId,
                snapshot: record.snapshot,
                replayedEvents: 0,
                ignoredDuplicateEvents: 0,
                blockers: [],
                warnings: record.journal.length === 0 ? ['Record has no replay journal; snapshot integrity only was verified.'] : []
            });
        }
        catch (error) {
            return (0, Result_1.err)(new Result_1.DomainError(`Session persistence verification failed: ${error.message}`, 'SESSION_PERSISTENCE_VERIFY_FAILED'));
        }
    }
    recoverFromRecord(record) {
        const verified = this.verifyRecord(record);
        if (!verified.success)
            return verified;
        if (record.journal.length === 0) {
            return (0, Result_1.ok)({ ...verified.value, warnings: ['Recovery used verified snapshot because replay journal is empty.'] });
        }
        return this.replay(record.sessionId, record.journal.map(entry => entry.command), record.snapshot.checksum);
    }
    replay(sessionId, commands, expectedSnapshotChecksum) {
        try {
            const key = typeof sessionId === 'string' ? sessionId.trim() : '';
            if (!key)
                return (0, Result_1.err)(new Result_1.DomainError('Session id is required for replay.', 'SESSION_PERSISTENCE_SESSION_REQUIRED'));
            if (!Array.isArray(commands))
                return (0, Result_1.err)(new Result_1.DomainError('Replay commands must be an array.', 'SESSION_PERSISTENCE_INVALID_REPLAY'));
            const runtime = new LiveSessionRuntime_1.LiveSessionRuntime(this.runtimeOptions);
            let latestSnapshot;
            let replayedEvents = 0;
            let ignoredDuplicateEvents = 0;
            for (const command of commands) {
                const result = runtime.ingest({ ...command, sessionId: key });
                if (!result.success)
                    return (0, Result_1.err)(new Result_1.DomainError(result.error.message, result.error.code ?? 'SESSION_PERSISTENCE_REPLAY_FAILED'));
                latestSnapshot = result.value.snapshot;
                if (result.value.status === 'DUPLICATE_IGNORED')
                    ignoredDuplicateEvents += 1;
                else if (result.value.status === 'ACCEPTED')
                    replayedEvents += 1;
            }
            if (!latestSnapshot) {
                const reset = runtime.reset(key);
                if (!reset.success)
                    return reset;
                latestSnapshot = reset.value;
            }
            const blockers = [];
            if (expectedSnapshotChecksum && latestSnapshot.checksum !== expectedSnapshotChecksum) {
                blockers.push('Replay checksum does not match persisted snapshot checksum.');
            }
            if (blockers.length > 0) {
                return (0, Result_1.err)(new Result_1.DomainError(blockers.join('; '), 'SESSION_PERSISTENCE_REPLAY_CHECKSUM_MISMATCH'));
            }
            return (0, Result_1.ok)({
                engineVersion: 'session-persistence-engine-v1',
                status: 'REPLAYED',
                sessionId: key,
                snapshot: latestSnapshot,
                replayedEvents,
                ignoredDuplicateEvents,
                blockers: [],
                warnings: ignoredDuplicateEvents > 0 ? ['Replay ignored duplicated events using runtime idempotency keys.'] : []
            });
        }
        catch (error) {
            return (0, Result_1.err)(new Result_1.DomainError(`Session replay failed: ${error.message}`, 'SESSION_PERSISTENCE_REPLAY_FAILED'));
        }
    }
    validateRecord(record) {
        const blockers = [];
        if (!record || typeof record !== 'object')
            return ['Persistence record is required.'];
        if (record.schemaVersion !== 'session-persistence-v1')
            blockers.push('Unsupported persistence schema version.');
        blockers.push(...this.validateSnapshot(record.snapshot));
        blockers.push(...this.validateJournal(record.sessionId, record.journal));
        if (record.sessionId !== record.snapshot?.sessionId)
            blockers.push('Record session id does not match snapshot session id.');
        if (record.snapshotChecksum !== this.snapshotChecksum(record.snapshot))
            blockers.push('Snapshot checksum mismatch.');
        if (record.journalChecksum !== this.journalChecksum(record.journal))
            blockers.push('Journal checksum mismatch.');
        if (record.recordChecksum !== this.recordChecksum(record.sessionId, record.snapshotChecksum, record.journalChecksum, record.persistedAt)) {
            blockers.push('Record checksum mismatch.');
        }
        return blockers;
    }
    validateSnapshot(snapshot) {
        const errors = [];
        if (!snapshot || typeof snapshot !== 'object')
            return ['Snapshot is required.'];
        if (snapshot.engineVersion !== 'live-session-runtime-v1')
            errors.push('Unsupported live session snapshot version.');
        if (typeof snapshot.sessionId !== 'string' || snapshot.sessionId.trim().length === 0)
            errors.push('Snapshot session id is required.');
        if (!Number.isInteger(snapshot.roundCount) || snapshot.roundCount < 0)
            errors.push('Snapshot roundCount is invalid.');
        if (!Array.isArray(snapshot.historyWindow))
            errors.push('Snapshot historyWindow is required.');
        if (!Array.isArray(snapshot.warmupWindow))
            errors.push('Snapshot warmupWindow is required.');
        if (typeof snapshot.checksum !== 'string' || snapshot.checksum.length < 16)
            errors.push('Snapshot checksum is invalid.');
        return errors;
    }
    validateJournal(sessionId, journal) {
        const errors = [];
        if (!Array.isArray(journal))
            return ['Journal must be an array.'];
        for (let index = 0; index < journal.length; index += 1) {
            const entry = journal[index];
            if (!entry || typeof entry !== 'object') {
                errors.push(`Journal entry ${index} is invalid.`);
                continue;
            }
            if (!entry.command || typeof entry.command !== 'object')
                errors.push(`Journal entry ${index} command is required.`);
            else {
                if (entry.command.sessionId !== sessionId)
                    errors.push(`Journal entry ${index} session id mismatch.`);
                if (!Number.isInteger(entry.command.value) || entry.command.value < 0 || entry.command.value > 36)
                    errors.push(`Journal entry ${index} roulette value is invalid.`);
            }
            if (typeof entry.idempotencyKey !== 'string' || entry.idempotencyKey.trim().length === 0)
                errors.push(`Journal entry ${index} idempotencyKey is required.`);
            if (typeof entry.accepted !== 'boolean')
                errors.push(`Journal entry ${index} accepted flag is required.`);
            if (typeof entry.recordedAt !== 'string' || entry.recordedAt.trim().length === 0)
                errors.push(`Journal entry ${index} recordedAt is required.`);
        }
        return errors;
    }
    snapshotChecksum(snapshot) {
        return this.hash([
            snapshot.engineVersion,
            snapshot.sessionId,
            String(snapshot.roundCount),
            snapshot.historyWindow.join(','),
            snapshot.warmupWindow.join(','),
            snapshot.checksum,
            snapshot.updatedAt
        ].join('|'));
    }
    journalChecksum(journal) {
        return this.hash(journal.map(entry => [
            entry.command.sessionId,
            entry.command.value,
            entry.command.eventId ?? '',
            entry.command.sequence ?? '',
            entry.command.occurredAt ?? '',
            entry.idempotencyKey,
            entry.accepted ? '1' : '0',
            entry.recordedAt
        ].join(':')).join('|'));
    }
    recordChecksum(sessionId, snapshotChecksum, journalChecksum, persistedAt) {
        return this.hash(`session-persistence-v1|${sessionId}|${snapshotChecksum}|${journalChecksum}|${persistedAt}`);
    }
    hash(value) {
        return crypto_1.default.createHash('sha256').update(value).digest('hex');
    }
}
exports.SessionPersistenceEngine = SessionPersistenceEngine;
