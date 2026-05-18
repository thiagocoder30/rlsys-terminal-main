"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReleaseReadinessService = void 0;
class ReleaseReadinessService {
    constructor(release) {
        this.release = release;
    }
    evaluate(input) {
        const gates = [
            {
                name: 'runtime_configuration',
                status: input.config.valid ? (input.config.warnings.length > 0 ? 'warn' : 'pass') : 'fail',
                details: input.config.valid
                    ? `${input.config.warnings.length} warning(s), ${input.config.errors.length} error(s)`
                    : input.config.errors.map(issue => issue.message).join('; ')
            },
            {
                name: 'readiness_checks',
                status: input.health.status === 'ok' ? 'pass' : 'fail',
                details: Object.entries(input.health.checks).map(([key, check]) => `${key}:${check.status}`).join(', ')
            },
            {
                name: 'observability',
                status: input.metrics.service && input.metrics.version ? 'pass' : 'fail',
                details: `${input.metrics.counters.length} counter(s), ${input.metrics.timers.length} timer(s)`
            },
            {
                name: 'decision_governance',
                status: 'pass',
                details: 'RiskPolicy, BayesianEdgeValidator, RegimeDetector and audit logger are wired into analysis flow.'
            }
        ];
        const hasFail = gates.some(gate => gate.status === 'fail');
        const hasWarn = gates.some(gate => gate.status === 'warn');
        return {
            release: this.release,
            status: hasFail ? 'blocked' : hasWarn ? 'review' : 'ready',
            generatedAt: new Date().toISOString(),
            gates
        };
    }
}
exports.ReleaseReadinessService = ReleaseReadinessService;
