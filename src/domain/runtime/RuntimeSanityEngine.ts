export type RuntimeSanityStatus =
  | 'SANITY_OK'
  | 'SANITY_REVIEW'
  | 'PARADIGM_BREAK'
  | 'BLOCKED';

export interface RuntimeDistributionBucket {
  readonly key: string;
  readonly expectedRatio: number;
  readonly observedRatio: number;
}

export interface RuntimeSanityInput {
  readonly snapshotId: string;
  readonly sampleSize: number;
  readonly snapshotConfidence: number;
  readonly dataIntegrityScore: number;
  readonly regimeMismatchScore: number;
  readonly spatialDriftScore: number;
  readonly distribution: readonly RuntimeDistributionBucket[];
}

export interface RuntimeSanityPolicy {
  readonly minSampleSize: number;
  readonly minSnapshotConfidence: number;
  readonly minDataIntegrityScore: number;
  readonly reviewDivergenceThreshold: number;
  readonly paradigmBreakDivergenceThreshold: number;
  readonly paradigmBreakPressureThreshold: number;
  readonly maxBuckets: number;
}

export interface RuntimeSanityReport {
  readonly status: RuntimeSanityStatus;
  readonly snapshotId: string;
  readonly sampleSize: number;
  readonly divergenceScore: number;
  readonly regimeMismatchScore: number;
  readonly spatialDriftScore: number;
  readonly dataIntegrityScore: number;
  readonly snapshotConfidence: number;
  readonly pressureScore: number;
  readonly primaryReason: string;
  readonly auditChecksum: string;
}

export interface ResultOk<T> {
  readonly ok: true;
  readonly value: T;
}

export interface ResultErr {
  readonly ok: false;
  readonly error: string;
}

export type Result<T> = ResultOk<T> | ResultErr;

const DEFAULT_POLICY: RuntimeSanityPolicy = {
  minSampleSize: 40,
  minSnapshotConfidence: 0.55,
  minDataIntegrityScore: 0.9,
  reviewDivergenceThreshold: 0.18,
  paradigmBreakDivergenceThreshold: 0.34,
  paradigmBreakPressureThreshold: 0.72,
  maxBuckets: 64
};

/**
 * RuntimeSanityEngine validates whether live observations still match the
 * offline-validated knowledge snapshot. It does not authorize bets; it only
 * returns a defensive runtime sanity status.
 */
export class RuntimeSanityEngine {
  public evaluate(
    input: RuntimeSanityInput,
    policy: Partial<RuntimeSanityPolicy> = {}
  ): Result<RuntimeSanityReport> {
    const activePolicy = this.mergePolicy(policy);
    const validationError = this.validateInput(input, activePolicy);

    if (validationError !== null) {
      return { ok: false, error: validationError };
    }

    if (input.sampleSize < activePolicy.minSampleSize) {
      return {
        ok: true,
        value: this.buildReport(input, 0, 0, 'BLOCKED', 'INSUFFICIENT_RUNTIME_SAMPLE')
      };
    }

    if (input.dataIntegrityScore < activePolicy.minDataIntegrityScore) {
      const pressureScore = this.clamp01(1 - input.dataIntegrityScore);

      return {
        ok: true,
        value: this.buildReport(
          input,
          0,
          pressureScore,
          'PARADIGM_BREAK',
          'DATA_INTEGRITY_DEGRADED'
        )
      };
    }

    if (input.snapshotConfidence < activePolicy.minSnapshotConfidence) {
      const pressureScore = this.clamp01(1 - input.snapshotConfidence);

      return {
        ok: true,
        value: this.buildReport(
          input,
          0,
          pressureScore,
          'SANITY_REVIEW',
          'SNAPSHOT_CONFIDENCE_LOW'
        )
      };
    }

    const divergenceScore = this.computeDistributionDivergence(input.distribution);
    const pressureScore = this.computePressureScore(input, divergenceScore);

    if (
      divergenceScore >= activePolicy.paradigmBreakDivergenceThreshold ||
      pressureScore >= activePolicy.paradigmBreakPressureThreshold
    ) {
      return {
        ok: true,
        value: this.buildReport(
          input,
          divergenceScore,
          pressureScore,
          'PARADIGM_BREAK',
          'RUNTIME_DIVERGED_FROM_SNAPSHOT'
        )
      };
    }

    if (
      divergenceScore >= activePolicy.reviewDivergenceThreshold ||
      input.regimeMismatchScore >= 0.35 ||
      input.spatialDriftScore >= 0.35
    ) {
      return {
        ok: true,
        value: this.buildReport(
          input,
          divergenceScore,
          pressureScore,
          'SANITY_REVIEW',
          'RUNTIME_REVIEW_REQUIRED'
        )
      };
    }

    return {
      ok: true,
      value: this.buildReport(
        input,
        divergenceScore,
        pressureScore,
        'SANITY_OK',
        'RUNTIME_MATCHES_SNAPSHOT'
      )
    };
  }

  private mergePolicy(policy: Partial<RuntimeSanityPolicy>): RuntimeSanityPolicy {
    return {
      ...DEFAULT_POLICY,
      ...policy
    };
  }

  private validateInput(
    input: RuntimeSanityInput,
    policy: RuntimeSanityPolicy
  ): string | null {
    if (typeof input !== 'object' || input === null) {
      return 'INVALID_RUNTIME_SANITY_INPUT';
    }

    if (typeof input.snapshotId !== 'string' || input.snapshotId.trim().length === 0) {
      return 'INVALID_SNAPSHOT_ID';
    }

    if (!Number.isInteger(input.sampleSize) || input.sampleSize < 0) {
      return 'INVALID_SAMPLE_SIZE';
    }

    if (!this.isUnitInterval(input.snapshotConfidence)) {
      return 'INVALID_SNAPSHOT_CONFIDENCE';
    }

    if (!this.isUnitInterval(input.dataIntegrityScore)) {
      return 'INVALID_DATA_INTEGRITY_SCORE';
    }

    if (!this.isUnitInterval(input.regimeMismatchScore)) {
      return 'INVALID_REGIME_MISMATCH_SCORE';
    }

    if (!this.isUnitInterval(input.spatialDriftScore)) {
      return 'INVALID_SPATIAL_DRIFT_SCORE';
    }

    if (!Array.isArray(input.distribution) || input.distribution.length === 0) {
      return 'INVALID_DISTRIBUTION';
    }

    if (input.distribution.length > policy.maxBuckets) {
      return 'DISTRIBUTION_TOO_LARGE';
    }

    for (const bucket of input.distribution) {
      if (typeof bucket.key !== 'string' || bucket.key.trim().length === 0) {
        return 'INVALID_DISTRIBUTION_BUCKET_KEY';
      }

      if (!this.isUnitInterval(bucket.expectedRatio)) {
        return 'INVALID_EXPECTED_RATIO';
      }

      if (!this.isUnitInterval(bucket.observedRatio)) {
        return 'INVALID_OBSERVED_RATIO';
      }
    }

    return null;
  }

  private computeDistributionDivergence(
    distribution: readonly RuntimeDistributionBucket[]
  ): number {
    let totalDifference = 0;

    for (const bucket of distribution) {
      totalDifference += Math.abs(bucket.expectedRatio - bucket.observedRatio);
    }

    return this.clamp01(totalDifference / 2);
  }

  private computePressureScore(
    input: RuntimeSanityInput,
    divergenceScore: number
  ): number {
    const confidencePenalty = 1 - input.snapshotConfidence;
    const integrityPenalty = 1 - input.dataIntegrityScore;

    return this.clamp01(
      divergenceScore * 0.45 +
      input.regimeMismatchScore * 0.22 +
      input.spatialDriftScore * 0.22 +
      confidencePenalty * 0.06 +
      integrityPenalty * 0.05
    );
  }

  private buildReport(
    input: RuntimeSanityInput,
    divergenceScore: number,
    pressureScore: number,
    status: RuntimeSanityStatus,
    primaryReason: string
  ): RuntimeSanityReport {
    return {
      status,
      snapshotId: input.snapshotId,
      sampleSize: input.sampleSize,
      divergenceScore: this.round(divergenceScore),
      regimeMismatchScore: this.round(input.regimeMismatchScore),
      spatialDriftScore: this.round(input.spatialDriftScore),
      dataIntegrityScore: this.round(input.dataIntegrityScore),
      snapshotConfidence: this.round(input.snapshotConfidence),
      pressureScore: this.round(pressureScore),
      primaryReason,
      auditChecksum: this.checksum([
        input.snapshotId,
        input.sampleSize,
        status,
        primaryReason,
        this.round(divergenceScore),
        this.round(pressureScore),
        this.round(input.regimeMismatchScore),
        this.round(input.spatialDriftScore),
        this.round(input.dataIntegrityScore),
        this.round(input.snapshotConfidence)
      ])
    };
  }

  private isUnitInterval(value: number): boolean {
    return Number.isFinite(value) && value >= 0 && value <= 1;
  }

  private clamp01(value: number): number {
    if (value < 0) {
      return 0;
    }

    if (value > 1) {
      return 1;
    }

    return value;
  }

  private round(value: number): number {
    return Math.round(value * 1_000_000) / 1_000_000;
  }

  private checksum(parts: readonly (string | number)[]): string {
    const payload = parts.join('|');
    let hash = 2_166_136_261;

    for (let index = 0; index < payload.length; index += 1) {
      hash ^= payload.charCodeAt(index);
      hash = Math.imul(hash, 16_777_619);
    }

    return (hash >>> 0).toString(16).padStart(8, '0');
  }
}
