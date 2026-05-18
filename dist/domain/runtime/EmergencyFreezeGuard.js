"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmergencyFreezeGuard = void 0;
const TelemetryContracts_1 = require("./TelemetryContracts");
class EmergencyFreezeGuard {
    /**
     * Avalia a telemetria em tempo O(1) e espaço O(1).
     * Padrão Specification estrito: Aborta no primeiro sinal de anomalia (Fail-Fast).
     */
    static evaluate(snapshot, policy) {
        // 1. Integridade Vital (Heartbeat)
        if (snapshot.lastHeartbeatAgeMs > policy.maxHeartbeatAgeMs) {
            return { isFrozen: true, reason: TelemetryContracts_1.FreezeReason.HEARTBEAT_LOST };
        }
        // 2. Cegueira de Sensores (OCR)
        if (snapshot.ocrConfidence < policy.minOcrConfidence) {
            return { isFrozen: true, reason: TelemetryContracts_1.FreezeReason.OCR_BLINDNESS };
        }
        // 3. Atraso Crítico (Latency)
        if (snapshot.latencyMs > policy.maxLatencyMs) {
            return { isFrozen: true, reason: TelemetryContracts_1.FreezeReason.HIGH_LATENCY };
        }
        // 4. Perda de Pacotes/Stream (Frames)
        if (snapshot.droppedFrames > policy.maxDroppedFrames) {
            return { isFrozen: true, reason: TelemetryContracts_1.FreezeReason.FRAME_DROPS };
        }
        return EmergencyFreezeGuard.HEALTHY_RESULT;
    }
}
exports.EmergencyFreezeGuard = EmergencyFreezeGuard;
// Padrão Flyweight: Reutiliza o mesmo objeto para evitar Garbage Collection em loops O(1)
EmergencyFreezeGuard.HEALTHY_RESULT = { isFrozen: false, reason: TelemetryContracts_1.FreezeReason.NONE };
