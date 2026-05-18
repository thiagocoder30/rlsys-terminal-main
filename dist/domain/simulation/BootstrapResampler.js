"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BootstrapResampler = void 0;
const crypto_1 = __importDefault(require("crypto"));
const RouletteStats_1 = require("../services/RouletteStats");
function hash(input) {
    return crypto_1.default.createHash('sha256').update(JSON.stringify(input)).digest('hex');
}
class DeterministicRandom {
    constructor(seed) {
        const digest = crypto_1.default.createHash('sha256').update(seed).digest();
        this.state = digest.readUInt32BE(0) || 0x9e3779b9;
    }
    next() {
        this.state = (1664525 * this.state + 1013904223) >>> 0;
        return this.state / 0x100000000;
    }
    int(maxExclusive) {
        return Math.floor(this.next() * Math.max(1, maxExclusive));
    }
}
class BootstrapResampler {
    createPlan(history, options = {}) {
        const values = this.validate(history);
        const blockSize = Math.max(1, Math.min(values.length, Math.floor(options.blockSize ?? Math.sqrt(values.length))));
        const sampleSize = Math.max(1, Math.floor(options.sampleSize ?? values.length));
        return {
            sourceLength: values.length,
            sampleSize,
            blockSize,
            preserveLocalDependence: options.preserveLocalDependence ?? true,
            seed: options.seed ?? 'rlsys-bootstrap-v2'
        };
    }
    sample(history, sampleId, options = {}) {
        const values = this.validate(history);
        const plan = this.createPlan(values, options);
        const rng = new DeterministicRandom(`${plan.seed}:${sampleId}:${hash(values.slice(0, 32))}`);
        const sampled = plan.preserveLocalDependence
            ? this.blockSample(values, plan.sampleSize, plan.blockSize, rng)
            : this.pointSample(values, plan.sampleSize, rng);
        const uniquePositions = new Set();
        sampled.sourceIndexes.forEach(index => uniquePositions.add(index));
        const replacementRatio = 1 - uniquePositions.size / Math.max(1, plan.sampleSize);
        const resultValues = sampled.values.slice(0, plan.sampleSize);
        return {
            id: `bootstrap-${sampleId}`,
            values: resultValues,
            checksum: hash({ sampleId, values: resultValues, plan }),
            sourceLength: values.length,
            blockSize: plan.blockSize,
            replacementRatio: round(Math.max(0, Math.min(1, replacementRatio)))
        };
    }
    samples(history, count, options = {}) {
        const safeCount = Math.max(1, Math.floor(count));
        return Array.from({ length: safeCount }, (_, index) => this.sample(history, index, options));
    }
    validate(history) {
        const result = RouletteStats_1.RouletteStats.validate(history);
        if (!result.ok)
            throw new Error(`invalid_bootstrap_history: ${result.errors.slice(0, 3).join('; ')}`);
        if (result.values.length < 80)
            throw new Error('insufficient_bootstrap_history: minimum 80 valid spins required');
        return result.values;
    }
    pointSample(values, sampleSize, rng) {
        const output = [];
        const sourceIndexes = [];
        for (let index = 0; index < sampleSize; index += 1) {
            const sourceIndex = rng.int(values.length);
            output.push(values[sourceIndex]);
            sourceIndexes.push(sourceIndex);
        }
        return { values: output, sourceIndexes };
    }
    blockSample(values, sampleSize, blockSize, rng) {
        const output = [];
        const sourceIndexes = [];
        while (output.length < sampleSize) {
            const start = rng.int(values.length);
            for (let offset = 0; offset < blockSize && output.length < sampleSize; offset += 1) {
                const sourceIndex = (start + offset) % values.length;
                output.push(values[sourceIndex]);
                sourceIndexes.push(sourceIndex);
            }
        }
        return { values: output, sourceIndexes };
    }
}
exports.BootstrapResampler = BootstrapResampler;
function round(value) {
    return Math.round(value * 10000) / 10000;
}
