"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionCircuitBreaker = exports.SessionStatus = void 0;
var SessionStatus;
(function (SessionStatus) {
    SessionStatus["SESSION_OPEN"] = "SESSION_OPEN";
    SessionStatus["SESSION_REVIEW"] = "SESSION_REVIEW";
    SessionStatus["SESSION_LOCKED"] = "SESSION_LOCKED";
    SessionStatus["SESSION_PROFIT_LOCKED"] = "SESSION_PROFIT_LOCKED";
    SessionStatus["BLOCKED"] = "BLOCKED";
})(SessionStatus || (exports.SessionStatus = SessionStatus = {}));
class SessionCircuitBreaker {
    static evaluate(state) {
        if (!state.dataIntegrityValid || state.mandatoryCooldownActive)
            return SessionStatus.BLOCKED;
        if (state.sanityEngineState === 'PARADIGM_BREAK')
            return SessionStatus.SESSION_LOCKED;
        const diff = state.currentBankroll - state.initialBankroll;
        if (diff <= (state.stopLossThreshold * -1))
            return SessionStatus.SESSION_LOCKED;
        if (diff >= state.stopWinThreshold)
            return SessionStatus.SESSION_PROFIT_LOCKED;
        if (state.drawdownVelocityAlert || state.sanityEngineState === 'DIVERGENT') {
            return SessionStatus.SESSION_REVIEW;
        }
        return SessionStatus.SESSION_OPEN;
    }
}
exports.SessionCircuitBreaker = SessionCircuitBreaker;
