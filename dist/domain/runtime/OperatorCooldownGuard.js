"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OperatorCooldownGuard = void 0;
const CooldownContracts_1 = require("./CooldownContracts");
class OperatorCooldownGuard {
    constructor(policy, repository) {
        this.policy = policy;
        this.repository = repository;
        this.lockTimestampMs = null;
        this.activeReason = null;
        this.requiredDurationMs = 0;
        this.restoreState();
    }
    restoreState() {
        if (!this.repository)
            return;
        const savedState = this.repository.load();
        if (savedState) {
            this.lockTimestampMs = savedState.lockTimestampMs;
            this.activeReason = savedState.activeReason;
            this.requiredDurationMs = savedState.requiredDurationMs;
        }
    }
    enforceLock(reason, currentTimeMs) {
        const newDuration = this.getDurationForReason(reason);
        const currentStatus = this.evaluate(currentTimeMs);
        if (currentStatus.isActive && currentStatus.remainingMs > newDuration) {
            return; // Mantém o bloqueio mais rigoroso
        }
        this.lockTimestampMs = currentTimeMs;
        this.activeReason = reason;
        this.requiredDurationMs = newDuration;
        // Persiste o estado O(1) apenas na mudança
        if (this.repository) {
            this.repository.save({
                lockTimestampMs: this.lockTimestampMs,
                activeReason: this.activeReason,
                requiredDurationMs: this.requiredDurationMs
            });
        }
    }
    evaluate(currentTimeMs) {
        if (this.lockTimestampMs === null) {
            return { isActive: false, remainingMs: 0, reason: null };
        }
        const elapsedMs = currentTimeMs - this.lockTimestampMs;
        const remainingMs = this.requiredDurationMs - elapsedMs;
        if (remainingMs <= 0) {
            this.clear();
            return { isActive: false, remainingMs: 0, reason: null };
        }
        return { isActive: true, remainingMs, reason: this.activeReason };
    }
    clear() {
        this.lockTimestampMs = null;
        this.activeReason = null;
        this.requiredDurationMs = 0;
        if (this.repository) {
            this.repository.clear();
        }
    }
    getDurationForReason(reason) {
        switch (reason) {
            case CooldownContracts_1.CooldownReason.STOP_LOSS: return this.policy.stopLossMs;
            case CooldownContracts_1.CooldownReason.DRAWDOWN_VELOCITY: return this.policy.drawdownVelocityMs;
            case CooldownContracts_1.CooldownReason.PARADIGM_BREAK: return this.policy.paradigmBreakMs;
            case CooldownContracts_1.CooldownReason.MANUAL_EMERGENCY: return this.policy.manualEmergencyMs;
            default: return 0;
        }
    }
}
exports.OperatorCooldownGuard = OperatorCooldownGuard;
