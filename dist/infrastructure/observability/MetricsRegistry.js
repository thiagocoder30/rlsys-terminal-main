"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetricsRegistry = void 0;
class MetricsRegistry {
    constructor(service = 'rl-sys-core', version = '0.9.0') {
        this.service = service;
        this.version = version;
        this.counters = new Map();
        this.timers = new Map();
        this.startedAt = Date.now();
    }
    increment(name, amount = 1) {
        this.counters.set(name, (this.counters.get(name) ?? 0) + amount);
    }
    observeDuration(name, durationMs) {
        const bucket = this.timers.get(name) ?? [];
        bucket.push(Math.max(0, durationMs));
        if (bucket.length > 1000)
            bucket.shift();
        this.timers.set(name, bucket);
    }
    snapshot() {
        const memory = process.memoryUsage();
        return {
            service: this.service,
            version: this.version,
            timestamp: new Date().toISOString(),
            uptimeSeconds: Number(((Date.now() - this.startedAt) / 1000).toFixed(3)),
            counters: Array.from(this.counters.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => a.name.localeCompare(b.name)),
            timers: Array.from(this.timers.entries()).map(([name, values]) => this.timerSnapshot(name, values)).sort((a, b) => a.name.localeCompare(b.name)),
            memory: {
                rssMb: this.toMb(memory.rss),
                heapUsedMb: this.toMb(memory.heapUsed),
                heapTotalMb: this.toMb(memory.heapTotal)
            }
        };
    }
    timerSnapshot(name, values) {
        if (values.length === 0)
            return { name, count: 0, avgMs: 0, p95Ms: 0, maxMs: 0 };
        const sorted = [...values].sort((a, b) => a - b);
        const sum = values.reduce((acc, value) => acc + value, 0);
        const p95Index = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1);
        return {
            name,
            count: values.length,
            avgMs: Number((sum / values.length).toFixed(3)),
            p95Ms: Number(sorted[p95Index].toFixed(3)),
            maxMs: Number(sorted[sorted.length - 1].toFixed(3))
        };
    }
    toMb(bytes) {
        return Number((bytes / 1024 / 1024).toFixed(2));
    }
}
exports.MetricsRegistry = MetricsRegistry;
