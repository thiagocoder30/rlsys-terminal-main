"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RuntimeDrawdownLock = void 0;
const MIN_WINDOW_MS = 1;
/**
 * RuntimeDrawdownLock avalia degradacao de capital em O(1).
 *
 * Ele nao tenta prever a roleta. A responsabilidade deste modulo e bloquear
 * a continuidade operacional quando a velocidade de perda indica possivel
 * quebra de regime, snapshot invalido, tilt operacional ou input degradado.
 */
class RuntimeDrawdownLock {
    evaluate(input) {
        if (!this.isValidInput(input)) {
            return {
                ok: false,
                error: 'INVALID_DRAWDOWN_INPUT'
            };
        }
        const sessionLoss = Math.max(0, input.initialBankroll - input.currentBankroll);
        const absoluteDrawdown = Math.max(0, input.peakBankroll - input.currentBankroll);
        const windowLoss = Math.max(0, input.previousBankroll - input.currentBankroll);
        const lossVelocityPerMinute = windowLoss / (input.elapsedWindowMs / 60000);
        if (!input.dataIntegrityValid) {
            return this.success('BLOCKED', sessionLoss, absoluteDrawdown, windowLoss, lossVelocityPerMinute, 'DATA_INTEGRITY_FAILURE');
        }
        if (sessionLoss >= input.absoluteStopLoss) {
            return this.success('DRAWDOWN_LOCKED', sessionLoss, absoluteDrawdown, windowLoss, lossVelocityPerMinute, 'ABSOLUTE_STOP_LOSS_HIT');
        }
        if (absoluteDrawdown >= input.hardDrawdownThreshold) {
            return this.success('DRAWDOWN_LOCKED', sessionLoss, absoluteDrawdown, windowLoss, lossVelocityPerMinute, 'HARD_DRAWDOWN_THRESHOLD_HIT');
        }
        if (lossVelocityPerMinute >= input.maxLossVelocityPerMinute) {
            return this.success('DRAWDOWN_LOCKED', sessionLoss, absoluteDrawdown, windowLoss, lossVelocityPerMinute, 'DRAWDOWN_VELOCITY_LOCK');
        }
        if (absoluteDrawdown >= input.reviewDrawdownThreshold) {
            return this.success('DRAWDOWN_REVIEW', sessionLoss, absoluteDrawdown, windowLoss, lossVelocityPerMinute, 'DRAWDOWN_REVIEW_THRESHOLD_HIT');
        }
        return this.success('DRAWDOWN_OK', sessionLoss, absoluteDrawdown, windowLoss, lossVelocityPerMinute, 'CAPITAL_CURVE_HEALTHY');
    }
    isValidInput(input) {
        return (this.isNonNegativeFinite(input.initialBankroll) &&
            this.isNonNegativeFinite(input.currentBankroll) &&
            this.isNonNegativeFinite(input.peakBankroll) &&
            this.isNonNegativeFinite(input.previousBankroll) &&
            this.isPositiveFinite(input.elapsedWindowMs) &&
            input.elapsedWindowMs >= MIN_WINDOW_MS &&
            this.isPositiveFinite(input.absoluteStopLoss) &&
            this.isPositiveFinite(input.reviewDrawdownThreshold) &&
            this.isPositiveFinite(input.hardDrawdownThreshold) &&
            this.isPositiveFinite(input.maxLossVelocityPerMinute) &&
            input.hardDrawdownThreshold >= input.reviewDrawdownThreshold &&
            input.peakBankroll >= input.currentBankroll &&
            typeof input.dataIntegrityValid === 'boolean');
    }
    isNonNegativeFinite(value) {
        return Number.isFinite(value) && value >= 0;
    }
    isPositiveFinite(value) {
        return Number.isFinite(value) && value > 0;
    }
    success(status, sessionLoss, absoluteDrawdown, windowLoss, lossVelocityPerMinute, reason) {
        return {
            ok: true,
            value: {
                status,
                sessionLoss,
                absoluteDrawdown,
                windowLoss,
                lossVelocityPerMinute,
                reason
            }
        };
    }
}
exports.RuntimeDrawdownLock = RuntimeDrawdownLock;
