"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LiveSessionCoordinator = void 0;
const IntegrationPorts_1 = require("./IntegrationPorts");
const DecisionContracts_1 = require("../../domain/decision/DecisionContracts");
const PositionSizingEngine_1 = require("../../domain/finance/PositionSizingEngine");
class LiveSessionCoordinator {
    constructor(healthGuard, financialGuard, cooldownGuard, tacticalEngine) {
        this.healthGuard = healthGuard;
        this.financialGuard = financialGuard;
        this.cooldownGuard = cooldownGuard;
        this.tacticalEngine = tacticalEngine;
    }
    processLiveSpin(liveState, currentTimeMs) {
        try {
            if (this.healthGuard.checkHealth() === IntegrationPorts_1.DefenseStatus.BLOCKED)
                return this.buildRejection('SYSTEM_HEALTH_COMPROMISED');
            if (this.cooldownGuard.isOperatorReady(currentTimeMs) === IntegrationPorts_1.DefenseStatus.BLOCKED)
                return this.buildRejection('OPERATOR_IN_COOLDOWN');
            if (this.financialGuard.authorizeEntry() === IntegrationPorts_1.DefenseStatus.BLOCKED)
                return this.buildRejection('FINANCIAL_DRAWDOWN_ACTIVE');
            const decision = this.tacticalEngine.evaluate(liveState);
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
    registerOutcome(pnl, currentTimeMs) {
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
