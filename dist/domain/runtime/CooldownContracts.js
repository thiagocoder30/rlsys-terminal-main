"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CooldownReason = void 0;
var CooldownReason;
(function (CooldownReason) {
    CooldownReason["STOP_LOSS"] = "STOP_LOSS";
    CooldownReason["DRAWDOWN_VELOCITY"] = "DRAWDOWN_VELOCITY";
    CooldownReason["PARADIGM_BREAK"] = "PARADIGM_BREAK";
    CooldownReason["MANUAL_EMERGENCY"] = "MANUAL_EMERGENCY";
})(CooldownReason || (exports.CooldownReason = CooldownReason = {}));
