"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RuntimePerformanceBudgetEngine = void 0;
const crypto_1 = __importDefault(require("crypto"));
const Result_1 = require("../shared/Result");
/**
 * Evaluates runtime resource pressure against a fixed performance budget.
 *
 * This engine is a pure domain guard. It does not read process memory, touch the
 * filesystem or subscribe to timers. Infrastructure adapters provide a bounded
 * sample, while this class returns a deterministic budget decision.
 *
 * Complexity: O(1) time and O(1) space because the number of inspected metrics
 * is fixed. This is intentional for Helio P22 / 2GB RAM deployments.
 */
class RuntimePerformanceBudgetEngine {
    static lowEndAndroidPolicy() {
        return {
            deviceClass: 'LOW_END_ANDROID',
            maxLatencyMs: 180,
            maxHeapMb: 384,
            maxEventQueueDepth: 32,
            maxEventsPerSecond: 18,
            maxObserverFailures: 0,
            maxPendingPersistenceWrites: 6
        };
    }
    evaluate(sample, policy = RuntimePerformanceBudgetEngine.lowEndAndroidPolicy()) {
        try {
            this.validateSample(sample);
            this.validatePolicy(policy);
            const violations = this.violations(sample, policy);
            const status = this.status(violations, sample.thermalState);
            const action = this.action(status, sample.thermalState);
            const headroomScore = this.headroomScore(sample, policy);
            const throttleFactor = this.throttleFactor(status, headroomScore, sample.thermalState);
            const recommendations = this.recommendations(status, action, violations, sample.thermalState);
            const auditChecksum = this.checksum(sample, policy, violations, status, action, throttleFactor, headroomScore);
            return (0, Result_1.ok)({
                engineVersion: 'runtime-performance-budget-v1',
                sessionId: sample.sessionId,
                status,
                action,
                throttleFactor,
                headroomScore,
                policy,
                sample,
                violations,
                recommendations,
                auditChecksum
            });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'unknown_runtime_performance_budget_error';
            return (0, Result_1.err)(new Result_1.DomainError(message, 'RUNTIME_PERFORMANCE_BUDGET_FAILED'));
        }
    }
    validateSample(sample) {
        if (!sample || typeof sample !== 'object')
            throw new Error('invalid_runtime_budget_sample');
        if (!sample.sessionId || typeof sample.sessionId !== 'string')
            throw new Error('invalid_runtime_budget_session');
        this.assertNonNegativeInteger(sample.measuredAtSpin, 'invalid_runtime_budget_spin');
        this.assertFiniteNonNegative(sample.latencyMs, 'invalid_runtime_budget_latency');
        this.assertFiniteNonNegative(sample.heapUsedMb, 'invalid_runtime_budget_heap');
        this.assertNonNegativeInteger(sample.eventQueueDepth, 'invalid_runtime_budget_queue');
        this.assertFiniteNonNegative(sample.eventsPerSecond, 'invalid_runtime_budget_events_per_second');
        this.assertNonNegativeInteger(sample.observerFailures, 'invalid_runtime_budget_observer_failures');
        this.assertNonNegativeInteger(sample.pendingPersistenceWrites, 'invalid_runtime_budget_pending_writes');
        if (!['NOMINAL', 'WARM', 'HOT', 'CRITICAL'].includes(sample.thermalState))
            throw new Error('invalid_runtime_budget_thermal_state');
        this.assertNonNegativeInteger(sample.activeModules, 'invalid_runtime_budget_active_modules');
    }
    validatePolicy(policy) {
        if (!policy || typeof policy !== 'object')
            throw new Error('invalid_runtime_budget_policy');
        if (!['LOW_END_ANDROID', 'STANDARD', 'HIGH_THROUGHPUT'].includes(policy.deviceClass))
            throw new Error('invalid_runtime_budget_device_class');
        this.assertPositive(policy.maxLatencyMs, 'invalid_runtime_budget_max_latency');
        this.assertPositive(policy.maxHeapMb, 'invalid_runtime_budget_max_heap');
        this.assertPositiveInteger(policy.maxEventQueueDepth, 'invalid_runtime_budget_max_queue');
        this.assertPositive(policy.maxEventsPerSecond, 'invalid_runtime_budget_max_events_per_second');
        this.assertNonNegativeInteger(policy.maxObserverFailures, 'invalid_runtime_budget_max_failures');
        this.assertPositiveInteger(policy.maxPendingPersistenceWrites, 'invalid_runtime_budget_max_writes');
    }
    violations(sample, policy) {
        const violations = [];
        this.pushIfExceeded(violations, 'latencyMs', sample.latencyMs, policy.maxLatencyMs, 'Latência acima do orçamento de decisão live.');
        this.pushIfExceeded(violations, 'heapUsedMb', sample.heapUsedMb, policy.maxHeapMb, 'Uso de heap acima do orçamento seguro para Android low-end.');
        this.pushIfExceeded(violations, 'eventQueueDepth', sample.eventQueueDepth, policy.maxEventQueueDepth, 'Fila de eventos acima do limite operacional.');
        this.pushIfExceeded(violations, 'eventsPerSecond', sample.eventsPerSecond, policy.maxEventsPerSecond, 'Taxa de eventos acima do orçamento de processamento.');
        this.pushIfExceeded(violations, 'observerFailures', sample.observerFailures, policy.maxObserverFailures, 'Falhas de observers detectadas no barramento interno.');
        this.pushIfExceeded(violations, 'pendingPersistenceWrites', sample.pendingPersistenceWrites, policy.maxPendingPersistenceWrites, 'Backlog de persistência acima do limite seguro.');
        if (sample.thermalState === 'HOT') {
            violations.push({ metric: 'thermalState', observed: sample.thermalState, limit: 'WARM', severity: 'WARNING', message: 'Dispositivo aquecido; reduzir trabalho não crítico.' });
        }
        if (sample.thermalState === 'CRITICAL') {
            violations.push({ metric: 'thermalState', observed: sample.thermalState, limit: 'HOT', severity: 'CRITICAL', message: 'Estado térmico crítico; bloquear avaliação live.' });
        }
        return violations;
    }
    pushIfExceeded(target, metric, observed, limit, message) {
        if (observed <= limit)
            return;
        const ratio = observed / limit;
        target.push({
            metric,
            observed: round(observed),
            limit: round(limit),
            severity: ratio >= 1.5 ? 'CRITICAL' : 'WARNING',
            message
        });
    }
    status(violations, thermalState) {
        if (thermalState === 'CRITICAL')
            return 'BLOCKED';
        if (violations.some(violation => violation.severity === 'CRITICAL'))
            return 'DEGRADED';
        if (violations.length > 0 || thermalState === 'HOT')
            return 'THROTTLE';
        return 'WITHIN_BUDGET';
    }
    action(status, thermalState) {
        if (status === 'BLOCKED' || thermalState === 'CRITICAL')
            return 'BLOCK_LIVE_EVALUATION';
        if (status === 'DEGRADED')
            return 'DEFER_NON_CRITICAL_WORK';
        if (status === 'THROTTLE')
            return 'REDUCE_SAMPLING';
        return 'CONTINUE';
    }
    headroomScore(sample, policy) {
        const ratios = [
            sample.latencyMs / policy.maxLatencyMs,
            sample.heapUsedMb / policy.maxHeapMb,
            sample.eventQueueDepth / policy.maxEventQueueDepth,
            sample.eventsPerSecond / policy.maxEventsPerSecond,
            policy.maxObserverFailures === 0 ? (sample.observerFailures === 0 ? 0 : 1) : sample.observerFailures / policy.maxObserverFailures,
            sample.pendingPersistenceWrites / policy.maxPendingPersistenceWrites
        ];
        let pressure = 0;
        for (const ratio of ratios) {
            if (ratio > pressure)
                pressure = ratio;
        }
        const thermalPenalty = sample.thermalState === 'CRITICAL' ? 1 : sample.thermalState === 'HOT' ? 0.35 : sample.thermalState === 'WARM' ? 0.12 : 0;
        return clamp(round(1 - Math.min(1, Math.max(pressure, thermalPenalty))), 0, 1);
    }
    throttleFactor(status, headroomScore, thermalState) {
        if (status === 'WITHIN_BUDGET')
            return 1;
        if (status === 'BLOCKED' || thermalState === 'CRITICAL')
            return 0;
        if (status === 'DEGRADED')
            return clamp(round(Math.min(0.5, headroomScore)), 0.15, 0.5);
        return clamp(round(Math.max(0.35, headroomScore)), 0.35, 0.85);
    }
    recommendations(status, action, violations, thermalState) {
        const recommendations = [];
        if (status === 'WITHIN_BUDGET')
            recommendations.push('Manter execução live em modo research-only com frequência atual.');
        if (action === 'REDUCE_SAMPLING')
            recommendations.push('Reduzir frequência de amostragem e priorizar estatísticas incrementais.');
        if (action === 'DEFER_NON_CRITICAL_WORK')
            recommendations.push('Adiar tarefas não críticas: relatórios extensos, simulações e persistência não urgente.');
        if (action === 'BLOCK_LIVE_EVALUATION')
            recommendations.push('Bloquear avaliação live até o dispositivo voltar ao orçamento operacional.');
        if (thermalState === 'HOT' || thermalState === 'CRITICAL')
            recommendations.push('Aguardar resfriamento do dispositivo antes de retomar análise intensiva.');
        for (const violation of violations.slice(0, 4)) {
            recommendations.push(`${violation.metric}: ${violation.message}`);
        }
        return recommendations.slice(0, 8);
    }
    checksum(sample, policy, violations, status, action, throttleFactor, headroomScore) {
        const payload = JSON.stringify({ sample, policy, violations, status, action, throttleFactor, headroomScore });
        return crypto_1.default.createHash('sha256').update(payload).digest('hex');
    }
    assertFiniteNonNegative(value, message) {
        if (!Number.isFinite(value) || value < 0)
            throw new Error(message);
    }
    assertPositive(value, message) {
        if (!Number.isFinite(value) || value <= 0)
            throw new Error(message);
    }
    assertNonNegativeInteger(value, message) {
        if (!Number.isInteger(value) || value < 0)
            throw new Error(message);
    }
    assertPositiveInteger(value, message) {
        if (!Number.isInteger(value) || value <= 0)
            throw new Error(message);
    }
}
exports.RuntimePerformanceBudgetEngine = RuntimePerformanceBudgetEngine;
function round(value) {
    return Number(value.toFixed(6));
}
function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}
