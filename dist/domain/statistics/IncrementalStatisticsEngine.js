"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IncrementalStatisticsEngine = void 0;
const crypto_1 = __importDefault(require("crypto"));
const Result_1 = require("../shared/Result");
const ROULETTE_VALUES = 37;
const DEFAULT_WINDOW_SIZE = 120;
const DEFAULT_IDEMPOTENCY_CACHE_SIZE = 512;
const SECTORS = ['voisins', 'tiers', 'orphelins', 'zero'];
const SECTOR_NUMBERS = {
    voisins: [22, 18, 29, 7, 28, 12, 35, 3, 26, 0, 32, 15, 19, 4, 21, 2, 25],
    tiers: [27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33],
    orphelins: [1, 20, 14, 31, 9, 17, 34, 6],
    zero: [0]
};
/**
 * Incremental O(1) roulette statistics engine for live sessions.
 *
 * The engine uses a fixed-size circular buffer and bounded idempotency cache.
 * Window updates mutate numeric counters directly instead of recomputing over
 * the entire live history. Snapshot entropy is O(37), which is constant for a
 * European roulette wheel and safe for low-memory Android devices.
 */
class IncrementalStatisticsEngine {
    constructor(options = {}) {
        this.sectorCounts = new Map();
        this.eventIds = new Set();
        this.eventIdQueue = [];
        this.cursor = 0;
        this.activeSize = 0;
        this.totalAccepted = 0;
        this.duplicateEvents = 0;
        this.repeatTransitions = 0;
        this.alternationTransitions = 0;
        this.windowSize = Math.max(8, Math.trunc(options.windowSize ?? DEFAULT_WINDOW_SIZE));
        this.idempotencyCacheSize = Math.max(this.windowSize, Math.trunc(options.idempotencyCacheSize ?? DEFAULT_IDEMPOTENCY_CACHE_SIZE));
        this.values = new Array(this.windowSize).fill(-1);
        this.counts = new Array(ROULETTE_VALUES).fill(0);
        for (const sector of SECTORS)
            this.sectorCounts.set(sector, 0);
    }
    ingest(command) {
        const validation = this.validate(command);
        if (validation.length > 0)
            return (0, Result_1.err)(new Result_1.DomainError(validation.join('; '), 'INCREMENTAL_STATS_INVALID_SPIN'));
        const idempotencyKey = this.idempotencyKey(command);
        if (this.eventIds.has(idempotencyKey)) {
            this.duplicateEvents += 1;
            return (0, Result_1.ok)({ status: 'DUPLICATE_IGNORED', idempotencyKey, snapshot: this.snapshot() });
        }
        this.trackEventId(idempotencyKey);
        this.acceptValue(command.value);
        return (0, Result_1.ok)({ status: 'ACCEPTED', idempotencyKey, snapshot: this.snapshot() });
    }
    replay(commands) {
        if (!Array.isArray(commands))
            return (0, Result_1.err)(new Result_1.DomainError('commands must be an array', 'INCREMENTAL_STATS_INVALID_REPLAY'));
        for (const command of commands) {
            const result = this.ingest(command);
            if (!result.success)
                return (0, Result_1.err)(result.error);
        }
        return (0, Result_1.ok)(this.snapshot());
    }
    snapshot() {
        const entropy = this.normalizedEntropy();
        const maxCount = this.maxCount();
        const activeSize = this.activeSize;
        const hotNumbers = this.pickHotNumbers(maxCount);
        const coldNumbers = this.pickColdNumbers();
        const repeatRate = activeSize <= 1 ? 0 : this.repeatTransitions / (activeSize - 1);
        const alternationRate = activeSize <= 1 ? 0 : this.alternationTransitions / (activeSize - 1);
        return {
            engineVersion: 'incremental-statistics-v1',
            windowSize: this.windowSize,
            activeSize,
            totalAccepted: this.totalAccepted,
            duplicateEvents: this.duplicateEvents,
            lastValue: this.lastValue,
            uniqueNumbers: this.counts.reduce((total, count) => total + (count > 0 ? 1 : 0), 0),
            normalizedEntropy: this.round(entropy),
            repeatRate: this.round(repeatRate),
            alternationRate: this.round(alternationRate),
            maxNumberConcentration: this.round(activeSize === 0 ? 0 : maxCount / activeSize),
            hotNumbers,
            coldNumbers,
            sectors: this.sectorSnapshots(activeSize),
            trend: this.trend(activeSize, entropy, repeatRate, maxCount),
            checksum: this.checksum()
        };
    }
    reset() {
        this.values.fill(-1);
        this.counts.fill(0);
        for (const sector of SECTORS)
            this.sectorCounts.set(sector, 0);
        this.eventIds.clear();
        this.eventIdQueue.splice(0, this.eventIdQueue.length);
        this.cursor = 0;
        this.activeSize = 0;
        this.totalAccepted = 0;
        this.duplicateEvents = 0;
        this.repeatTransitions = 0;
        this.alternationTransitions = 0;
        this.lastValue = undefined;
    }
    acceptValue(value) {
        const previousLast = this.lastValue;
        if (this.activeSize === this.windowSize) {
            const outgoing = this.values[this.cursor];
            this.decrement(outgoing);
        }
        else {
            this.activeSize += 1;
        }
        this.values[this.cursor] = value;
        this.cursor = (this.cursor + 1) % this.windowSize;
        this.increment(value);
        this.totalAccepted += 1;
        if (previousLast !== undefined) {
            if (previousLast === value)
                this.repeatTransitions += 1;
            else
                this.alternationTransitions += 1;
            this.rebalanceTransitionsWhenWindowFull();
        }
        this.lastValue = value;
    }
    rebalanceTransitionsWhenWindowFull() {
        const maxTransitions = Math.max(0, this.activeSize - 1);
        const totalTransitions = this.repeatTransitions + this.alternationTransitions;
        if (totalTransitions <= maxTransitions)
            return;
        const overflow = totalTransitions - maxTransitions;
        if (this.alternationTransitions >= overflow)
            this.alternationTransitions -= overflow;
        else {
            const remaining = overflow - this.alternationTransitions;
            this.alternationTransitions = 0;
            this.repeatTransitions = Math.max(0, this.repeatTransitions - remaining);
        }
    }
    increment(value) {
        this.counts[value] += 1;
        const sector = this.sectorFor(value);
        this.sectorCounts.set(sector, (this.sectorCounts.get(sector) ?? 0) + 1);
    }
    decrement(value) {
        if (value < 0)
            return;
        this.counts[value] = Math.max(0, this.counts[value] - 1);
        const sector = this.sectorFor(value);
        this.sectorCounts.set(sector, Math.max(0, (this.sectorCounts.get(sector) ?? 0) - 1));
    }
    sectorFor(value) {
        for (const sector of SECTORS) {
            if (SECTOR_NUMBERS[sector].includes(value))
                return sector;
        }
        return 'orphelins';
    }
    normalizedEntropy() {
        if (this.activeSize === 0)
            return 0;
        let entropy = 0;
        for (const count of this.counts) {
            if (count === 0)
                continue;
            const probability = count / this.activeSize;
            entropy -= probability * Math.log2(probability);
        }
        return entropy / Math.log2(ROULETTE_VALUES);
    }
    maxCount() {
        let max = 0;
        for (const count of this.counts)
            if (count > max)
                max = count;
        return max;
    }
    pickHotNumbers(maxCount) {
        if (maxCount === 0)
            return [];
        const numbers = [];
        for (let number = 0; number < this.counts.length; number += 1) {
            if (this.counts[number] === maxCount)
                numbers.push(number);
            if (numbers.length === 5)
                break;
        }
        return numbers;
    }
    pickColdNumbers() {
        if (this.activeSize === 0)
            return [];
        const numbers = [];
        for (let number = 0; number < this.counts.length; number += 1) {
            if (this.counts[number] === 0)
                numbers.push(number);
            if (numbers.length === 5)
                break;
        }
        return numbers;
    }
    sectorSnapshots(activeSize) {
        return SECTORS.map(sector => {
            const hits = this.sectorCounts.get(sector) ?? 0;
            return { name: sector, hits, hitRate: this.round(activeSize === 0 ? 0 : hits / activeSize) };
        });
    }
    trend(activeSize, entropy, repeatRate, maxCount) {
        if (activeSize < Math.min(16, this.windowSize))
            return 'INSUFFICIENT_DATA';
        const concentration = activeSize === 0 ? 0 : maxCount / activeSize;
        if (repeatRate >= 0.35)
            return 'REPEATING';
        if (concentration >= 0.22 || entropy < 0.62)
            return 'CONCENTRATING';
        return 'BALANCED';
    }
    validate(command) {
        const errors = [];
        if (!command || typeof command !== 'object')
            errors.push('command is required');
        if (!Number.isInteger(command.value) || command.value < 0 || command.value > 36)
            errors.push(`invalid roulette value: ${String(command.value)}`);
        if (command.sequence !== undefined && (!Number.isInteger(command.sequence) || command.sequence < 0))
            errors.push('sequence must be a non-negative integer');
        return errors;
    }
    idempotencyKey(command) {
        if (command.eventId && command.eventId.trim().length > 0)
            return command.eventId.trim();
        return crypto_1.default.createHash('sha256').update(`${command.sequence ?? 'no-seq'}|${command.value}`).digest('hex').slice(0, 24);
    }
    trackEventId(idempotencyKey) {
        this.eventIds.add(idempotencyKey);
        this.eventIdQueue.push(idempotencyKey);
        while (this.eventIdQueue.length > this.idempotencyCacheSize) {
            const oldest = this.eventIdQueue.shift();
            if (oldest)
                this.eventIds.delete(oldest);
        }
    }
    checksum() {
        const ordered = this.orderedValues().join(',');
        return crypto_1.default.createHash('sha256').update(`${this.windowSize}|${this.activeSize}|${ordered}`).digest('hex');
    }
    orderedValues() {
        const output = [];
        const start = this.activeSize === this.windowSize ? this.cursor : 0;
        for (let offset = 0; offset < this.activeSize; offset += 1) {
            output.push(this.values[(start + offset) % this.windowSize]);
        }
        return output;
    }
    round(value) {
        return Number.isFinite(value) ? Number(value.toFixed(6)) : 0;
    }
}
exports.IncrementalStatisticsEngine = IncrementalStatisticsEngine;
