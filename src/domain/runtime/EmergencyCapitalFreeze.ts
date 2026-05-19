export enum EmergencyFreezeStatus {
  FREEZE_OK = 'FREEZE_OK',
  FREEZE_REVIEW = 'FREEZE_REVIEW',
  FREEZE_TRIGGERED = 'FREEZE_TRIGGERED',
  BLOCKED = 'BLOCKED'
}

export interface EmergencyFreezeInput {
  readonly dataIntegrityValid: boolean;
  readonly runtimeHeartbeatAlive: boolean;
  readonly snapshotAvailable: boolean;
  readonly ledgerPersistenceHealthy: boolean;
  readonly eventLoopLagMs: number;
  readonly memoryPressureCritical: boolean;
  readonly ocrTimeoutDetected: boolean;
}

export class EmergencyCapitalFreeze {
  public static evaluate(
    input: EmergencyFreezeInput
  ): EmergencyFreezeStatus {

    if (!input.dataIntegrityValid) {
      return EmergencyFreezeStatus.BLOCKED;
    }

    if (!input.runtimeHeartbeatAlive) {
      return EmergencyFreezeStatus.FREEZE_TRIGGERED;
    }

    if (!input.snapshotAvailable) {
      return EmergencyFreezeStatus.FREEZE_TRIGGERED;
    }

    if (!input.ledgerPersistenceHealthy) {
      return EmergencyFreezeStatus.FREEZE_TRIGGERED;
    }

    if (input.memoryPressureCritical) {
      return EmergencyFreezeStatus.FREEZE_TRIGGERED;
    }

    if (input.ocrTimeoutDetected) {
      return EmergencyFreezeStatus.FREEZE_REVIEW;
    }

    if (input.eventLoopLagMs >= 500) {
      return EmergencyFreezeStatus.FREEZE_REVIEW;
    }

    return EmergencyFreezeStatus.FREEZE_OK;
  }
}
