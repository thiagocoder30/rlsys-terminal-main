"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FreezeReason = void 0;
var FreezeReason;
(function (FreezeReason) {
    FreezeReason["NONE"] = "NONE";
    FreezeReason["HIGH_LATENCY"] = "HIGH_LATENCY";
    FreezeReason["FRAME_DROPS"] = "FRAME_DROPS";
    FreezeReason["OCR_BLINDNESS"] = "OCR_BLINDNESS";
    FreezeReason["HEARTBEAT_LOST"] = "HEARTBEAT_LOST";
})(FreezeReason || (exports.FreezeReason = FreezeReason = {}));
