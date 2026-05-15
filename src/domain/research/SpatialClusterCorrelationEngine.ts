export type SpatialClusterCorrelationStatus =
  | 'CLUSTER_CORRELATION_CANDIDATE'
  | 'WEAK_CORRELATION'
  | 'INCONCLUSIVE'
  | 'BLOCKED';

export interface SpatialClusterRecord {
  readonly eventId: string;
  readonly rouletteNumber: number;
  readonly dealerId?: string;
  readonly regime?: string;
  readonly contextId?: string;
}

export interface SpatialClusterCorrelationPolicy {
  readonly minSampleSize: number;
  readonly minContextSampleSize: number;
  readonly maxSampleSize: number;
  readonly clusterSize: number;
  readonly minLiftForCandidate: number;
  readonly minCorrelationScoreForCandidate: number;
  readonly minLiftForWeakCorrelation: number;
}

export interface SpatialClusterBucket {
  readonly clusterId: number;
  readonly hits: number;
  readonly ratio: number;
  readonly baselineRatio: number;
  readonly lift: number;
}

export interface SpatialContextSummary {
  readonly contextKey: string;
  readonly sampleSize: number;
  readonly dominantClusterId: number;
  readonly dominantClusterRatio: number;
  readonly baselineRatio: number;
  readonly lift: number;
  readonly entropyScore: number;
  readonly correlationScore: number;
  readonly clusters: readonly SpatialClusterBucket[];
}

export interface SpatialClusterCorrelationReport {
  readonly status: SpatialClusterCorrelationStatus;
  readonly totalRecords: number;
  readonly uniqueContexts: number;
  readonly dominantContext: SpatialContextSummary | null;
  readonly reason: string;
  readonly checksum: string;
}

export interface ResultSuccess<T> {
  readonly ok: true;
  readonly value: T;
}

export interface ResultFailure {
  readonly ok: false;
  readonly error: string;
}

export type Result<T> = ResultSuccess<T> | ResultFailure;

const EUROPEAN_WHEEL_ORDER: readonly number[] = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34,
  6, 27, 13, 36, 11, 30, 8, 23, 10, 5,
  24, 16, 33, 1, 20, 14, 31, 9, 22, 18,
  29, 7, 28, 12, 35, 3, 26
];

const NUMBER_TO_WHEEL_INDEX: ReadonlyMap<number, number> = new Map(
  EUROPEAN_WHEEL_ORDER.map((value, index) => [value, index])
);

const DEFAULT_POLICY: SpatialClusterCorrelationPolicy = {
  minSampleSize: 80,
  minContextSampleSize: 30,
  maxSampleSize: 20000,
  clusterSize: 5,
  minLiftForCandidate: 1.75,
  minCorrelationScoreForCandidate: 0.18,
  minLiftForWeakCorrelation: 1.25
};

/**
 * Detects whether an operational context concentrates outcomes in a physical
 * wheel cluster above the global baseline. The engine is deterministic,
 * iterative and research-only.
 */
export class SpatialClusterCorrelationEngine {
  public evaluate(
    records: readonly SpatialClusterRecord[],
    policyOverrides: Partial<SpatialClusterCorrelationPolicy> = {}
  ): Result<SpatialClusterCorrelationReport> {
    try {
      if (!Array.isArray(records)) {
        return { ok: false, error: 'INVALID_RECORDS' };
      }

      const policyResult = this.resolvePolicy(policyOverrides);

      if (!policyResult.ok) {
        return policyResult;
      }

      const policy = policyResult.value;

      if (records.length < policy.minSampleSize) {
        return {
          ok: true,
          value: this.emptyReport(
            'BLOCKED',
            records.length,
            'INSUFFICIENT_SAMPLE'
          )
        };
      }

      if (records.length > policy.maxSampleSize) {
        return {
          ok: true,
          value: this.emptyReport(
            'BLOCKED',
            records.length,
            'SAMPLE_LIMIT_EXCEEDED'
          )
        };
      }

      const seenEventIds = new Set<string>();
      const globalClusterHits = new Map<number, number>();
      const contextClusterHits = new Map<string, Map<number, number>>();
      const contextTotals = new Map<string, number>();
      let acceptedRecords = 0;

      for (const record of records) {
        const validation = this.validateRecord(record);

        if (!validation.ok) {
          return validation;
        }

        if (seenEventIds.has(record.eventId)) {
          continue;
        }

        seenEventIds.add(record.eventId);

        const clusterId = this.toClusterId(record.rouletteNumber, policy.clusterSize);
        const contextKey = this.toContextKey(record);

        acceptedRecords += 1;
        globalClusterHits.set(clusterId, (globalClusterHits.get(clusterId) ?? 0) + 1);
        contextTotals.set(contextKey, (contextTotals.get(contextKey) ?? 0) + 1);

        const contextHits = contextClusterHits.get(contextKey) ?? new Map<number, number>();
        contextHits.set(clusterId, (contextHits.get(clusterId) ?? 0) + 1);
        contextClusterHits.set(contextKey, contextHits);
      }

      if (acceptedRecords < policy.minSampleSize) {
        return {
          ok: true,
          value: this.emptyReport(
            'BLOCKED',
            acceptedRecords,
            'INSUFFICIENT_UNIQUE_SAMPLE'
          )
        };
      }

      const bestContext = this.findBestContext(
        contextClusterHits,
        contextTotals,
        globalClusterHits,
        acceptedRecords,
        policy
      );

      if (bestContext === null) {
        return {
          ok: true,
          value: this.emptyReport(
            'INCONCLUSIVE',
            acceptedRecords,
            'NO_CONTEXT_WITH_ENOUGH_SAMPLE',
            contextTotals.size
          )
        };
      }

      const status = this.classify(bestContext, policy);

      return {
        ok: true,
        value: {
          status,
          totalRecords: acceptedRecords,
          uniqueContexts: contextTotals.size,
          dominantContext: bestContext,
          reason: this.reasonFor(status),
          checksum: this.computeChecksum(acceptedRecords, contextTotals.size, bestContext)
        }
      };
    } catch {
      return { ok: false, error: 'SPATIAL_CLUSTER_CORRELATION_FAILURE' };
    }
  }

  private resolvePolicy(
    overrides: Partial<SpatialClusterCorrelationPolicy>
  ): Result<SpatialClusterCorrelationPolicy> {
    const policy: SpatialClusterCorrelationPolicy = {
      ...DEFAULT_POLICY,
      ...overrides
    };

    const isValid =
      Number.isInteger(policy.minSampleSize) &&
      Number.isInteger(policy.minContextSampleSize) &&
      Number.isInteger(policy.maxSampleSize) &&
      Number.isInteger(policy.clusterSize) &&
      policy.minSampleSize > 0 &&
      policy.minContextSampleSize > 0 &&
      policy.maxSampleSize >= policy.minSampleSize &&
      policy.clusterSize > 0 &&
      policy.clusterSize <= EUROPEAN_WHEEL_ORDER.length &&
      Number.isFinite(policy.minLiftForCandidate) &&
      Number.isFinite(policy.minCorrelationScoreForCandidate) &&
      Number.isFinite(policy.minLiftForWeakCorrelation);

    if (!isValid) {
      return { ok: false, error: 'INVALID_POLICY' };
    }

    return { ok: true, value: policy };
  }

  private validateRecord(record: SpatialClusterRecord): Result<true> {
    if (typeof record !== 'object' || record === null) {
      return { ok: false, error: 'INVALID_RECORD' };
    }

    if (typeof record.eventId !== 'string' || record.eventId.trim().length === 0) {
      return { ok: false, error: 'INVALID_EVENT_ID' };
    }

    if (!Number.isInteger(record.rouletteNumber) || record.rouletteNumber < 0 || record.rouletteNumber > 36) {
      return { ok: false, error: 'INVALID_ROULETTE_NUMBER' };
    }

    return { ok: true, value: true };
  }

  private toClusterId(rouletteNumber: number, clusterSize: number): number {
    const wheelIndex = NUMBER_TO_WHEEL_INDEX.get(rouletteNumber);

    if (wheelIndex === undefined) {
      return -1;
    }

    return Math.floor(wheelIndex / clusterSize);
  }

  private toContextKey(record: SpatialClusterRecord): string {
    if (typeof record.contextId === 'string' && record.contextId.trim().length > 0) {
      return `context:${record.contextId.trim()}`;
    }

    const dealer = typeof record.dealerId === 'string' && record.dealerId.trim().length > 0
      ? record.dealerId.trim()
      : 'UNKNOWN_DEALER';

    const regime = typeof record.regime === 'string' && record.regime.trim().length > 0
      ? record.regime.trim()
      : 'UNKNOWN_REGIME';

    return `dealer:${dealer}|regime:${regime}`;
  }

  private findBestContext(
    contextClusterHits: ReadonlyMap<string, ReadonlyMap<number, number>>,
    contextTotals: ReadonlyMap<string, number>,
    globalClusterHits: ReadonlyMap<number, number>,
    totalRecords: number,
    policy: SpatialClusterCorrelationPolicy
  ): SpatialContextSummary | null {
    let best: SpatialContextSummary | null = null;

    for (const [contextKey, clusterHits] of contextClusterHits.entries()) {
      const contextTotal = contextTotals.get(contextKey) ?? 0;

      if (contextTotal < policy.minContextSampleSize) {
        continue;
      }

      const summary = this.buildContextSummary(
        contextKey,
        contextTotal,
        clusterHits,
        globalClusterHits,
        totalRecords
      );

      if (best === null || summary.correlationScore > best.correlationScore) {
        best = summary;
      }
    }

    return best;
  }

  private buildContextSummary(
    contextKey: string,
    contextTotal: number,
    clusterHits: ReadonlyMap<number, number>,
    globalClusterHits: ReadonlyMap<number, number>,
    totalRecords: number
  ): SpatialContextSummary {
    const clusters: SpatialClusterBucket[] = [];
    let dominantClusterId = -1;
    let dominantHits = 0;
    let entropyScore = 0;

    for (const [clusterId, hits] of clusterHits.entries()) {
      const ratio = hits / contextTotal;
      const baselineRatio = (globalClusterHits.get(clusterId) ?? 0) / totalRecords;
      const lift = baselineRatio > 0 ? ratio / baselineRatio : 0;

      clusters.push({
        clusterId,
        hits,
        ratio,
        baselineRatio,
        lift
      });

      if (hits > dominantHits) {
        dominantHits = hits;
        dominantClusterId = clusterId;
      }

      if (ratio > 0) {
        entropyScore -= ratio * Math.log2(ratio);
      }
    }

    clusters.sort((left, right) => left.clusterId - right.clusterId);

    const dominantCluster = clusters.find((cluster) => cluster.clusterId === dominantClusterId);
    const dominantClusterRatio = dominantCluster?.ratio ?? 0;
    const baselineRatio = dominantCluster?.baselineRatio ?? 0;
    const lift = dominantCluster?.lift ?? 0;
    const correlationScore = Math.max(0, dominantClusterRatio - baselineRatio) * lift;

    return {
      contextKey,
      sampleSize: contextTotal,
      dominantClusterId,
      dominantClusterRatio,
      baselineRatio,
      lift,
      entropyScore,
      correlationScore,
      clusters
    };
  }

  private classify(
    summary: SpatialContextSummary,
    policy: SpatialClusterCorrelationPolicy
  ): SpatialClusterCorrelationStatus {
    if (
      summary.lift >= policy.minLiftForCandidate &&
      summary.correlationScore >= policy.minCorrelationScoreForCandidate
    ) {
      return 'CLUSTER_CORRELATION_CANDIDATE';
    }

    if (summary.lift >= policy.minLiftForWeakCorrelation) {
      return 'WEAK_CORRELATION';
    }

    return 'INCONCLUSIVE';
  }

  private reasonFor(status: SpatialClusterCorrelationStatus): string {
    if (status === 'CLUSTER_CORRELATION_CANDIDATE') {
      return 'CONTEXTUAL_SPATIAL_CLUSTER_DETECTED';
    }

    if (status === 'WEAK_CORRELATION') {
      return 'WEAK_CONTEXTUAL_SPATIAL_PRESSURE';
    }

    if (status === 'BLOCKED') {
      return 'BLOCKED_BY_POLICY';
    }

    return 'NO_SIGNIFICANT_CONTEXTUAL_CLUSTER';
  }

  private emptyReport(
    status: SpatialClusterCorrelationStatus,
    totalRecords: number,
    reason: string,
    uniqueContexts = 0
  ): SpatialClusterCorrelationReport {
    return {
      status,
      totalRecords,
      uniqueContexts,
      dominantContext: null,
      reason,
      checksum: this.computeChecksum(totalRecords, uniqueContexts, null)
    };
  }

  private computeChecksum(
    totalRecords: number,
    uniqueContexts: number,
    summary: SpatialContextSummary | null
  ): string {
    const parts = [
      String(totalRecords),
      String(uniqueContexts),
      summary?.contextKey ?? 'none',
      String(summary?.dominantClusterId ?? -1),
      summary?.dominantClusterRatio.toFixed(6) ?? '0.000000',
      summary?.lift.toFixed(6) ?? '0.000000',
      summary?.correlationScore.toFixed(6) ?? '0.000000'
    ];

    let hash = 2166136261;
    const payload = parts.join('|');

    for (let index = 0; index < payload.length; index += 1) {
      hash ^= payload.charCodeAt(index);
      hash = Math.imul(hash, 16777619) >>> 0;
    }

    return `scc-${hash.toString(16).padStart(8, '0')}`;
  }
}
