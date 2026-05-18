"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProcessSignalsUseCase = void 0;
const crypto_1 = require("crypto");
const Signal_1 = require("../entities/Signal");
class ProcessSignalsUseCase {
    constructor(historyBuffer) {
        this.historyBuffer = historyBuffer;
    }
    execute(values) {
        if (!Array.isArray(values)) {
            throw new Error('Input values must be an array.');
        }
        for (const value of values) {
            if (typeof value !== 'number' || Number.isNaN(value))
                continue;
            this.historyBuffer.addSignal(new Signal_1.Signal((0, crypto_1.randomUUID)(), value));
        }
    }
}
exports.ProcessSignalsUseCase = ProcessSignalsUseCase;
