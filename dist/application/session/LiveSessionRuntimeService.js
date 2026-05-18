"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LiveSessionRuntimeService = void 0;
const LiveSessionRuntime_1 = require("../../domain/session/LiveSessionRuntime");
const StrategyDecisionService_1 = require("../decision/StrategyDecisionService");
/**
 * Application boundary for round-by-round live session ingestion.
 *
 * The service preserves Clean Architecture by keeping runtime state in the domain
 * engine and using the StrategyDecisionService only after the warm-up window is
 * complete. Repeated events are idempotently ignored through the runtime engine.
 */
class LiveSessionRuntimeService {
    constructor(runtime = new LiveSessionRuntime_1.LiveSessionRuntime(), decisionService = new StrategyDecisionService_1.StrategyDecisionService()) {
        this.runtime = runtime;
        this.decisionService = decisionService;
    }
    ingest(input) {
        const command = this.normalizeCommand(input);
        const result = this.runtime.ingest(command);
        if (!result.success) {
            const snapshot = this.emptySnapshot(command.sessionId || 'invalid-session');
            return {
                service: 'LiveSessionRuntimeService',
                schemaVersion: '2.9.0',
                status: 'REJECTED',
                sessionId: command.sessionId || 'invalid-session',
                snapshot,
                executiveSummary: {
                    liveRuntimeGate: 'BLOCKED',
                    operationalGate: 'BLOCKED',
                    reason: result.error.message,
                    nextAction: 'REJECT_EVENT'
                },
                generatedAt: new Date().toISOString()
            };
        }
        const ingestion = result.value;
        const snapshot = ingestion.snapshot;
        const decision = snapshot.readyForDecision
            ? this.decisionService.evaluate({ values: snapshot.warmupWindow, bankroll: this.safeBankroll(input), sessionId: snapshot.sessionId, source: 'live-runtime' })
            : undefined;
        return {
            service: 'LiveSessionRuntimeService',
            schemaVersion: '2.9.0',
            status: ingestion.status,
            sessionId: snapshot.sessionId,
            ingestion,
            snapshot,
            decision,
            executiveSummary: this.summary(snapshot, ingestion.status, decision),
            generatedAt: new Date().toISOString()
        };
    }
    snapshot(sessionId) {
        const result = this.runtime.snapshotBySession(sessionId);
        if (!result.success) {
            const reset = this.runtime.reset(sessionId || 'unknown-session');
            const snapshot = reset.success ? reset.value : this.emptySnapshot(sessionId || 'unknown-session');
            return {
                service: 'LiveSessionRuntimeService',
                schemaVersion: '2.9.0',
                status: 'REJECTED',
                sessionId: snapshot.sessionId,
                snapshot,
                executiveSummary: {
                    liveRuntimeGate: 'BLOCKED',
                    operationalGate: 'BLOCKED',
                    reason: result.error.message,
                    nextAction: 'REJECT_EVENT'
                },
                generatedAt: new Date().toISOString()
            };
        }
        return {
            service: 'LiveSessionRuntimeService',
            schemaVersion: '2.9.0',
            status: 'ACCEPTED',
            sessionId: result.value.sessionId,
            snapshot: result.value,
            executiveSummary: this.summary(result.value, 'ACCEPTED'),
            generatedAt: new Date().toISOString()
        };
    }
    normalizeCommand(input) {
        if (!input || typeof input !== 'object') {
            return { sessionId: 'invalid-session', value: Number.NaN };
        }
        const payload = input;
        return {
            sessionId: typeof payload.sessionId === 'string' ? payload.sessionId : 'default-live-session',
            value: Number(payload.value),
            eventId: typeof payload.eventId === 'string' ? payload.eventId : undefined,
            sequence: Number.isInteger(payload.sequence) ? payload.sequence : undefined,
            occurredAt: typeof payload.occurredAt === 'string' ? payload.occurredAt : undefined
        };
    }
    safeBankroll(input) {
        if (!input || typeof input !== 'object')
            return 0;
        const bankroll = Number(input.bankroll ?? 0);
        return Number.isFinite(bankroll) && bankroll > 0 ? bankroll : 0;
    }
    summary(snapshot, ingestionStatus, decision) {
        if (snapshot.status === 'BLOCKED') {
            return { liveRuntimeGate: 'BLOCKED', operationalGate: 'BLOCKED', reason: 'Live runtime is blocked by validation or governance.', nextAction: 'REJECT_EVENT' };
        }
        if (snapshot.control.phase === 'COOLDOWN') {
            return { liveRuntimeGate: 'COOLDOWN', operationalGate: 'COOLDOWN', reason: snapshot.control.reason, nextAction: 'WAIT_COOLDOWN' };
        }
        if (!snapshot.readyForDecision || snapshot.control.phase === 'COLLECTING_WARMUP') {
            return { liveRuntimeGate: 'INITIALIZING', operationalGate: 'BLOCKED', reason: snapshot.control.reason, nextAction: 'COLLECT_MORE_ROUNDS' };
        }
        if (snapshot.control.phase === 'WARMUP_COMPLETE') {
            return { liveRuntimeGate: 'WARMUP_COMPLETE', operationalGate: 'OBSERVE', reason: snapshot.control.reason, nextAction: 'COLLECT_MORE_ROUNDS' };
        }
        if (ingestionStatus === 'DUPLICATE_IGNORED') {
            return { liveRuntimeGate: 'DECISION_READY', operationalGate: 'BLOCKED', reason: 'Duplicate event ignored; last valid decision state preserved.', nextAction: 'REVIEW_DECISION_REPORT' };
        }
        return {
            liveRuntimeGate: 'DECISION_READY',
            operationalGate: decision?.decision.operationalGate ?? 'OBSERVE',
            reason: decision
                ? `Decision engine returned ${decision.decision.action} with gate ${decision.decision.operationalGate} under research governance.`
                : 'Decision window ready for review.',
            nextAction: 'REVIEW_DECISION_REPORT'
        };
    }
    emptySnapshot(sessionId) {
        return {
            engineVersion: 'live-session-runtime-v1',
            sessionId,
            status: 'BLOCKED',
            roundCount: 0,
            acceptedEvents: 0,
            duplicateEvents: 0,
            rejectedEvents: 1,
            warmupProgress: 0,
            readyForDecision: false,
            historyWindow: [],
            warmupWindow: [],
            rolling: { windowSize: 0, uniqueNumbers: 0, normalizedEntropy: 0, repeatRate: 0, maxNumberConcentration: 0, alternationRate: 0 },
            control: { phase: 'BLOCKED', nextAction: 'REJECT_EVENT', spinsUntilWarmup: 100, spinsUntilDecision: 100, cooldownRemainingSpins: 0, decisionWindowSize: 100, reason: 'Snapshot vazio criado para evento rejeitado.' },
            checksum: '',
            updatedAt: new Date().toISOString()
        };
    }
}
exports.LiveSessionRuntimeService = LiveSessionRuntimeService;
