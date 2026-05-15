import { TelemetrySnapshot, FreezePolicy, FreezeResult, FreezeReason } from './TelemetryContracts';

export class EmergencyFreezeGuard {
  // Padrão Flyweight: Reutiliza o mesmo objeto para evitar Garbage Collection em loops O(1)
  private static readonly HEALTHY_RESULT: FreezeResult = { isFrozen: false, reason: FreezeReason.NONE };

  /**
   * Avalia a telemetria em tempo O(1) e espaço O(1).
   * Padrão Specification estrito: Aborta no primeiro sinal de anomalia (Fail-Fast).
   */
  public static evaluate(snapshot: TelemetrySnapshot, policy: FreezePolicy): FreezeResult {
    // 1. Integridade Vital (Heartbeat)
    if (snapshot.lastHeartbeatAgeMs > policy.maxHeartbeatAgeMs) {
      return { isFrozen: true, reason: FreezeReason.HEARTBEAT_LOST };
    }

    // 2. Cegueira de Sensores (OCR)
    if (snapshot.ocrConfidence < policy.minOcrConfidence) {
      return { isFrozen: true, reason: FreezeReason.OCR_BLINDNESS };
    }

    // 3. Atraso Crítico (Latency)
    if (snapshot.latencyMs > policy.maxLatencyMs) {
      return { isFrozen: true, reason: FreezeReason.HIGH_LATENCY };
    }

    // 4. Perda de Pacotes/Stream (Frames)
    if (snapshot.droppedFrames > policy.maxDroppedFrames) {
      return { isFrozen: true, reason: FreezeReason.FRAME_DROPS };
    }

    return EmergencyFreezeGuard.HEALTHY_RESULT;
  }
}
