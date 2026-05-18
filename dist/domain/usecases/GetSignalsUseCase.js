"use strict";
/**
 * @file GetSignalsUseCase.ts
 * @description Defines the use case for retrieving signals from the history buffer.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetSignalsUseCase = void 0;
/**
 * Use case responsible for fetching all available signals from the history buffer.
 * This class encapsulates the business logic for retrieving signals,
 * abstracting away the details of how signals are stored.
 */
class GetSignalsUseCase {
    /**
     * Creates an instance of GetSignalsUseCase.
     * @param historyBuffer The history buffer implementation to retrieve signals from.
     */
    constructor(historyBuffer) {
        this.historyBuffer = historyBuffer;
    }
    /**
     * Executes the use case to retrieve all signals.
     * @returns An array of Signal objects.
     */
    execute() {
        return this.historyBuffer.getSignals();
    }
}
exports.GetSignalsUseCase = GetSignalsUseCase;
