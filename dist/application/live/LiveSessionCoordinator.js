"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LiveSessionCoordinator = void 0;
const IntegrationPorts_1 = require("./IntegrationPorts");
const DecisionContracts_1 = require("../../domain/decision/DecisionContracts");
const PositionSizingEngine_1 = require("../../domain/finance/PositionSizingEngine");
const RuntimeEnforcementOrchestrator_1 = require("../../domain/runtime/RuntimeEnforcementOrchestrator");
class LiveSessionCoordinator {
    constructor(healthGuard, financialGuard, cooldownGuard, tacticalEngine) {
        this.healthGuard = healthGuard;
        this.financialGuard = financialGuard;
        this.cooldownGuard = cooldownGuard;
        this.tacticalEngine = tacticalEngine;
        this.runtimeEnforcementOrchestrator = new RuntimeEnforcementOrchestrator_1.RuntimeEnforcementOrchestrator();
    }
    processLiveSpin(liveState, currentTimeMs = Date.now()) {
        try {
            const normalizedLiveState = typeof liveState === 'number'
                ? { dealerId: 'UNKNOWN', wheelSpeedCategory: 'NORMAL', targetSector: liveState }
                : liveState;
            const healthStatus = this.healthGuard.checkHealth();
            const cooldownStatus = this.cooldownGuard.isOperatorReady(currentTimeMs);
            const financialStatus = this.financialGuard.authorizeEntry();
            const enforcementResult = this.runtimeEnforcementOrchestrator.evaluate({
                dataIntegrityValid: true,
                runtimeSanityState: 'SANITY_OK',
                sessionBreakerState: 'SESSION_OPEN',
                drawdownLockState: 'DRAWDOWN_OK',
                runtimeHealthState: healthStatus === IntegrationPorts_1.DefenseStatus.BLOCKED ? 'DOWN' : 'HEALTHY',
                cooldownActive: cooldownStatus === IntegrationPorts_1.DefenseStatus.BLOCKED,
                financialExposureAllowed: financialStatus !== IntegrationPorts_1.DefenseStatus.BLOCKED,
                candidateAvailable: true
            });
            if (!enforcementResult.ok) {
                return this.buildRejection(enforcementResult.error);
            }
            if (!enforcementResult.value.allowed) {
                return this.buildRejection(`RUNTIME_ENFORCEMENT_${enforcementResult.value.verdict}_${enforcementResult.value.reasons.join('_')}`);
            }
            const decision = this.tacticalEngine.evaluate(normalizedLiveState);
            // Injeção da Inteligência Financeira
            if (decision.action === DecisionContracts_1.ActionSignal.SIGNAL) {
                const losses = this.financialGuard.getConsecutiveLosses();
                const units = PositionSizingEngine_1.PositionSizingEngine.calculateUnits(decision.expectedEV, decision.confidence, losses);
                return { ...decision, recommendedUnits: units };
            }
            return decision;
        }
        catch (error) {
            return this.buildRejection('UNEXPECTED_RUNTIME_EXCEPTION');
        }
    }
    registerOutcome(pnl, currentTimeMs = Date.now()) {
        this.financialGuard.registerPnL(pnl);
        if (this.financialGuard.authorizeEntry() === IntegrationPorts_1.DefenseStatus.BLOCKED) {
            this.cooldownGuard.triggerCooldown(30 * 60 * 1000, currentTimeMs);
        }
    }
    buildRejection(reason) {
        return { action: DecisionContracts_1.ActionSignal.NO_GO, expectedEV: 0, confidence: 0, reason };
    }
}
exports.LiveSessionCoordinator = LiveSessionCoordinator;
