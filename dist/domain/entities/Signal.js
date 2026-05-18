"use strict";
/**
 * @file Signal.ts
 * @description Defines the Signal entity, representing a data point in the system.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Signal = void 0;
/**
 * Represents a single signal data point.
 */
class Signal {
    /**
     * Creates an instance of Signal.
     * @param id The unique identifier for the signal.
     * @param value The numerical value of the signal.
     * @param timestamp The timestamp when the signal was created. Defaults to the current time.
     */
    constructor(id, value, timestamp = new Date()) {
        if (typeof id !== 'string' || id.trim() === '') {
            throw new Error('Signal ID must be a non-empty string.');
        }
        if (typeof value !== 'number' || isNaN(value)) {
            throw new Error('Signal value must be a number.');
        }
        if (!(timestamp instanceof Date) || isNaN(timestamp.getTime())) {
            throw new Error('Signal timestamp must be a valid Date object.');
        }
        this.id = id;
        this.value = value;
        this.timestamp = timestamp;
    }
}
exports.Signal = Signal;
