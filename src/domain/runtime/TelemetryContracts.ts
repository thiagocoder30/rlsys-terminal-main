export interface TelemetrySnapshot {
  readonly latencyMs: number;
  readonly droppedFrames: number;
  readonly ocrConfidence: number;      // 0.0 a 1.0
  readonly lastHeartbeatAgeMs: number; // Tempo desde o último sinal vital
}

export interface FreezePolicy {
  readonly maxLatencyMs: number;
  readonly maxDroppedFrames: number;
  readonly minOcrConfidence: number;
  readonly maxHeartbeatAgeMs: number;
}

export enum FreezeReason {
  NONE = 'NONE',
  HIGH_LATENCY = 'HIGH_LATENCY',
  FRAME_DROPS = 'FRAME_DROPS',
  OCR_BLINDNESS = 'OCR_BLINDNESS',
  HEARTBEAT_LOST = 'HEARTBEAT_LOST'
}

export interface FreezeResult {
  readonly isFrozen: boolean;
  readonly reason: FreezeReason;
}
