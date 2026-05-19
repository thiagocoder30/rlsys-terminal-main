"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RuntimeEnforcementOrchestrator = void 0;
/**
 * Consolidates independent runtime guards into a single deterministic
 * enforcement verdict. The engine is stateless and performs a fixed number
 * of checks, which keeps runtime cost O(1) for low-memory devices.
 */
class RuntimeEnforcementOrchestrator {
    evaluate(input) {
        if (!this.isValidInput(input)) {
            return {
                ok: false,
                error: 'INVALID_RUNTIME_ENFORCEMENT_INPUT'
            };
        }
        if (!input.dataIntegrityValid) {
            return this.decision('BLOCKED', ['DATA_INTEGRITY_INVALID']);
        }
        if (input.runtimeHealthState === 'DOWN') {
            return this.decision('FREEZE', ['RUNTIME_HEALTH_DOWN']);
        }
        if (input.runtimeSanityState === 'BLOCKED') {
            return this.decision('BLOCKED', ['RUNTIME_SANITY_BLOCKED']);
        }
        if (input.runtimeSanityState === 'PARADIGM_BREAK') {
            return this.decision('LOCKED', ['PARADIGM_BREAK_DETECTED']);
        }
        if (input.sessionBreakerState === 'BLOCKED') {
            return this.decision('BLOCKED', ['SESSION_BREAKER_BLOCKED']);
        }
        if (input.sessionBreakerState === 'SESSION_LOCKED') {
            return this.decision('LOCKED', ['SESSION_LOCKED']);
        }
        if (input.sessionBreakerState === 'SESSION_PROFIT_LOCKED') {
            return this.decision('LOCKED', ['SESSION_PROFIT_LOCKED']);
        }
        if (input.drawdownLockState === 'BLOCKED') {
            return this.decision('BLOCKED', ['DRAWDOWN_BLOCKED']);
        }
        if (input.drawdownLockState === 'DRAWDOWN_LOCKED') {
            return this.decision('LOCKED', ['DRAWDOWN_LOCKED']);
        }
        if (input.cooldownActive) {
            return this.decision('NO_GO', ['COOLDOWN_ACTIVE']);
        }
        if (input.runtimeSanityState === 'SANITY_REVIEW' ||
            input.sessionBreakerState === 'SESSION_REVIEW' ||
            input.drawdownLockState === 'DRAWDOWN_REVIEW' ||
            input.runtimeHealthState === 'DEGRADED') {
            return this.decision('REVIEW', ['RUNTIME_REVIEW_REQUIRED']);
        }
        if (!input.financialExposureAllowed) {
            return this.decision('NO_GO', ['FINANCIAL_EXPOSURE_NOT_ALLOWED']);
        }
        if (!input.candidateAvailable) {
            return this.decision('NO_GO', ['NO_CANDIDATE_AVAILABLE']);
        }
        return this.decision('ALLOW', ['ALL_GUARDS_ALLOW']);
    }
    decision(verdict, reasons) {
        return {
            ok: true,
            value: {
                verdict,
                allowed: verdict === 'ALLOW',
                reasons
            }
        };
    }
    isValidInput(input) {
        return (typeof input === 'object' &&
            input !== null &&
            typeof input.dataIntegrityValid === 'boolean' &&
            typeof input.cooldownActive === 'boolean' &&
            typeof input.financialExposureAllowed === 'boolean' &&
            typeof input.candidateAvailable === 'boolean' &&
            this.isRuntimeSanityState(input.runtimeSanityState) &&
            this.isSessionBreakerState(input.sessionBreakerState) &&
            this.isDrawdownLockState(input.drawdownLockState) &&
            this.isRuntimeHealthState(input.runtimeHealthState));
    }
    isRuntimeSanityState(value) {
        return (value === 'SANITY_OK' ||
            value === 'SANITY_REVIEW' ||
            value === 'PARADIGM_BREAK' ||
            value === 'BLOCKED');
    }
    isSessionBreakerState(value) {
        return (value === 'SESSION_OPEN' ||
            value === 'SESSION_REVIEW' ||
            value === 'SESSION_LOCKED' ||
            value === 'SESSION_PROFIT_LOCKED' ||
            value === 'BLOCKED');
    }
    isDrawdownLockState(value) {
        return (value === 'DRAWDOWN_OK' ||
            value === 'DRAWDOWN_REVIEW' ||
            value === 'DRAWDOWN_LOCKED' ||
            value === 'BLOCKED');
    }
    isRuntimeHealthState(value) {
        return (value === 'HEALTHY' ||
            value === 'DEGRADED' ||
            value === 'DOWN');
    }
}
exports.RuntimeEnforcementOrchestrator = RuntimeEnforcementOrchestrator;
