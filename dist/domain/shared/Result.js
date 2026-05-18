"use strict";
/**
 * @file Result.ts
 * @description Implements the Result type for robust error handling,
 *              following the Railway-Oriented Programming pattern.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DomainError = exports.err = exports.ok = void 0;
/**
 * Creates a successful Result.
 * @template T The type of the successful value.
 * @template E The type of the error (inferred or explicitly provided).
 * @param value The successful value.
 * @returns A Result object indicating success.
 */
const ok = (value) => ({ success: true, value });
exports.ok = ok;
/**
 * Creates a failed Result.
 * @template T The type of the successful value (inferred or explicitly provided).
 * @template E The type of the error.
 * @param error The error object.
 * @returns A Result object indicating failure.
 */
const err = (error) => ({ success: false, error });
exports.err = err;
/**
 * Custom error class for domain-specific errors.
 */
class DomainError extends Error {
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = 'DomainError';
        Object.setPrototypeOf(this, DomainError.prototype);
    }
}
exports.DomainError = DomainError;
