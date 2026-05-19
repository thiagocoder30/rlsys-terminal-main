export enum SnapshotRevocationStatus {
  SNAPSHOT_VALID = 'SNAPSHOT_VALID',
  SNAPSHOT_REVIEW = 'SNAPSHOT_REVIEW',
  SNAPSHOT_REVOKED = 'SNAPSHOT_REVOKED',
  BLOCKED = 'BLOCKED'
}

export interface SnapshotRevocationInput {
  readonly runtimeSanityHealthy: boolean;
  readonly dataIntegrityValid: boolean;
  readonly snapshotExpired: boolean;
  readonly entropyDriftScore: number;
  readonly reviewEscalationCount: number;
}

export class SnapshotRevocationEngine {
  public static evaluate(
    input: SnapshotRevocationInput
  ): SnapshotRevocationStatus {

    if (!input.dataIntegrityValid) {
      return SnapshotRevocationStatus.BLOCKED;
    }

    if (input.snapshotExpired) {
      return SnapshotRevocationStatus.SNAPSHOT_REVOKED;
    }

    if (!input.runtimeSanityHealthy) {
      return SnapshotRevocationStatus.SNAPSHOT_REVOKED;
    }

    if (input.entropyDriftScore >= 0.85) {
      return SnapshotRevocationStatus.SNAPSHOT_REVOKED;
    }

    if (input.reviewEscalationCount >= 5) {
      return SnapshotRevocationStatus.SNAPSHOT_REVIEW;
    }

    return SnapshotRevocationStatus.SNAPSHOT_VALID;
  }
}
