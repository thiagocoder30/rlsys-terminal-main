"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StructuredLogger = void 0;
class StructuredLogger {
    constructor(service = 'rl-sys-core', minLevel = process.env.LOG_LEVEL || 'info') {
        this.service = service;
        this.minLevel = minLevel;
    }
    debug(message, context) {
        this.write('debug', message, context);
    }
    info(message, context) {
        this.write('info', message, context);
    }
    warn(message, context) {
        this.write('warn', message, context);
    }
    error(message, context) {
        this.write('error', message, context);
    }
    write(level, message, context) {
        if (!this.shouldLog(level))
            return;
        const record = {
            timestamp: new Date().toISOString(),
            level,
            service: this.service,
            message,
            context: this.sanitize(context)
        };
        const serialized = JSON.stringify(record);
        if (level === 'error')
            console.error(serialized);
        else if (level === 'warn')
            console.warn(serialized);
        else
            console.log(serialized);
    }
    shouldLog(level) {
        const order = { debug: 10, info: 20, warn: 30, error: 40 };
        return order[level] >= order[this.minLevel];
    }
    sanitize(context) {
        if (!context)
            return undefined;
        const blocked = new Set(['authorization', 'cookie', 'password', 'token', 'apiKey', 'geminiApiKey']);
        const sanitized = {};
        for (const [key, value] of Object.entries(context)) {
            sanitized[key] = blocked.has(key) ? '[REDACTED]' : value;
        }
        return sanitized;
    }
}
exports.StructuredLogger = StructuredLogger;
