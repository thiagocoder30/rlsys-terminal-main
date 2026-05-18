"use strict";
/**
 * @file SignalOrchestrator.ts
 * @description Orchestrates the processing of signals by delegating to the appropriate use case.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SignalOrchestrator = void 0;
/**
 * The SignalOrchestrator acts as an entry point for signal-related operations
 * from the application layer. It coordinates the execution of domain use cases
 * without containing business logic itself.
 */
class SignalOrchestrator {
    /**
     * Creates an instance of SignalOrchestrator.
     * @param processSignalsUseCase The use case responsible for processing and storing signals.
     */
    constructor(processSignalsUseCase) {
        this.processSignalsUseCase = processSignalsUseCase;
    }
    /**
     * Processes an array of numerical values, converting them into signals and storing them.
     * @param values An array of numbers to be processed.
     */
    process(values) {
        try {
            this.processSignalsUseCase.execute(values);
        }
        catch (error) {
            // Log the error or re-throw a more specific application-level error
            console.error('Error processing signals:', error instanceof Error ? error.message : String(error));
            throw new Error('Failed to process signals due to an internal error.');
        }
    }
}
exports.SignalOrchestrator = SignalOrchestrator;
