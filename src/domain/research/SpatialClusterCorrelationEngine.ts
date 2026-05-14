export type SpatialClusterCorrelationStatus =
  | 'CLUSTER_CORRELATION_CANDIDATE'
  | 'WEAK_CORRELATION'
  | 'INCONCLUSIVE'
  | 'BLOCKED';

export type SpatialCorrelationContextMode =
  | 'DEALER'
  | 'REGIME'
  | 'GLOBAL';

export interface SpatialClusterRecord {
  readonly rouletteNumber: number;
  readonly dealerId?: string;
  readonly regime?: string;
}

export interface SpatialClusterCorrelationPolicy {
  readonly minSampleSize: number;
  readonly clusterSize: number;
  readonly candidateRatioThreshold: number;
  readonly weakRatioThreshold: number;
  readonly maxRecords: number;
}

export interface SpatialClusterMetric {
  readonly clusterId: number;
  readonly wheelStartIndex: number;
  readonly wheelEndIndex: number;
  readonly hits: number;
  readonly ratio: number;
}

export interface SpatialContextCorrelation {
  readonly contextKey: string;
  readonly sampleSize: number;
  readonly dominantClusterId: number;
  readonly dominantClusterRatio: number;
  readonly baselineRatio: number;
  readonly lift: number;
  readonly status: SpatialClusterCorrelationStatus;
}

export interface SpatialClusterCorrelationReport {
  readonly status: SpatialClusterCorrelationStatus;
  readonly contextMode: SpatialCorrelationContextMode;
  readonly totalRecords: number;
  readonly clusterSize: number;
  readonly dominantContextKey: string;
  readonly dominantClusterId: number;
  readonly dominantClusterRatio: number;
  readonly baselineRatio: number;
  readonly lift: number;
  readonly clusters: readonly SpatialClusterMetric[];
  readonly contexts: readonly SpatialContextCorrelation[];
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

const ROULETTE_MIN = 0;
const ROULETTE_MAX = 36;

const DEFAULT_POLICY: SpatialClusterCorrelationPolicy = {
  minSampleSize: 80,
  clusterSize: 5,
  candidateRatioThreshold: 0.42,
  weakRatioThreshold: 0.34,
  maxRecords: 20_000
};

/**
 * Offline research engine for detecting spatial cluster correlations.
 *
 * The engine maps roulette outcomes to their physical wheel position and
 * aggregates deterministic cluster pressure by context. It intentionally
 * avoids runtime/mobile dependencies and never authorizes live stake.
 */
export class SpatialClusterCorrelationEngine {
  private readonly wheelIndexByNumber: ReadonlyMap<number, number>;

  public constructor() {
    const indexes = new Map<number, number>();

    for (let index = 0; index < EUROPEAN_WHEEL_ORDER.length; index += 1) {
      indexes.set(EUROPEAN_WHEEL_ORDER[index], index);
    }

    this.wheelIndexByNumber = indexes;
  }

  public analyze(
    records: readonly SpatialClusterRecord[],
    contextMode: SpatialCorrelationContextMode,
    policy: Partial<SpatialClusterCorrelationPolicy> = {}
  ): Result<SpatialClusterCorrelationReport> {
    try {
      if (!Array.isArray(records)) {
        return {
          ok: false,
          error: 'INVALID_RECORDS'
        };
      }

      if (!this.isValidContextMode(contextMode)) {
        return {
          ok: false,
          error: 'INVALID_CONTEXT_MODE'
        };
      }

      const normalizedPolicy = this.normalizePolicy(policy);

      if (records.length > normalizedPolicy.maxRecords) {
        return {
          ok: true,
          value: this.blockedReport(
            contextMode,
            records.length,
            normalizedPolicy,
            'BATCH_TOO_LARGE'
          )
        };
      }

      if (records.length < normalizedPolicy.minSampleSize) {
        return {
          ok: true,
          value: this.blockedReport(
            contextMode,
            records.length,
            normalizedPolicy,
            'INSUFFICIENT_SAMPLE'
          )
        };
      }

      const totalClusters = Math.ceil(
        EUROPEAN_WHEEL_ORDER.length / normalizedPolicy.clusterSize
      );

      const globalClusterHits = this.createCounter(totalClusters);
      const contextClusterHits = new Map<string, number[]>();
      const contextSampleSizes = new Map<string, number>();

      for (const record of records) {
        if (!this.isValidRouletteNumber(record.rouletteNumber)) {
          return {
            ok: false,
            error: 'INVALID_ROULETTE_NUMBER'
          };
        }

        const contextKey = this.resolveContextKey(record, contextMode);

        if (contextKey.length === 0) {
          return {
            ok: false,
            error: 'INVALID_CONTEXT_KEY'
          };
        }

        const clusterId = this.toClusterId(
          record.rouletteNumber,
          normalizedPolicy.clusterSize
        );

        globalClusterHits[clusterId] += 1;

        const currentContextHits =
          contextClusterHits.get(contextKey) ?? this.createCounter(totalClusters);

        currentContextHits[clusterId] += 1;
        contextClusterHits.set(contextKey, currentContextHits);

        contextSampleSizes.set(
          contextKey,
          (contextSampleSizes.get(contextKey) ?? 0) + 1
        );
      }

      const clusters = this.toClusterMetrics(
        globalClusterHits,
        records.length,
        normalizedPolicy.clusterSize
      );

      const baselineRatio = 1 / totalClusters;
      const contexts: SpatialContextCorrelation[] = [];

      let dominantContextKey = 'GLOBAL';
      let dominantClusterId = -1;
      let dominantClusterRatio = 0;
      let dominantLift = 0;

      for (const [contextKey, hits] of contextClusterHits.entries()) {
        const sampleSize = contextSampleSizes.get(contextKey) ?? 0;
        const dominant = this.findDominantCluster(hits);
        const ratio = sampleSize > 0 ? dominant.hits / sampleSize : 0;
        const lift = baselineRatio > 0 ? ratio / baselineRatio : 0;
        const status = this.toStatus(ratio, normalizedPolicy);

        contexts.push({
          contextKey,
          sampleSize,
          dominantClusterId: dominant.clusterId,
          dominantClusterRatio: ratio,
          baselineRatio,
          lift,
          status
        });

        if (ratio > dominantClusterRatio) {
          dominantContextKey = contextKey;
          dominantClusterId = dominant.clusterId;
          dominantClusterRatio = ratio;
          dominantLift = lift;
        }
      }

      contexts.sort((left, right) => {
        if (right.dominantClusterRatio !== left.dominantClusterRatio) {
          return right.dominantClusterRatio - left.dominantClusterRatio;
        }

        return left.contextKey.localeCompare(right.contextKey);
      });

      const status = this.toStatus(
        dominantClusterRatio,
        normalizedPolicy
      );

      return {
        ok: true,
        value: {
          status,
          contextMode,
          totalRecords: records.length,
          clusterSize: normalizedPolicy.clusterSize,
          dominantContextKey,
          dominantClusterId,
          dominantClusterRatio,
          baselineRatio,
          lift: dominantLift,
          clusters,
          contexts,
          reason: this.toReason(status),
          checksum: this.checksum([
            contextMode,
            String(records.length),
            dominantContextKey,
            String(dominantClusterId),
            dominantClusterRatio.toFixed(6),
            dominantLift.toFixed(6)
          ])
        }
      };
    } catch {
      return {
        ok: false,
        error: 'SPATIAL_CLUSTER_CORRELATION_FAILURE'
      };
    }
  }

  private normalizePolicy(
    policy: Partial<SpatialClusterCorrelationPolicy>
  ): SpatialClusterCorrelationPolicy {
    return {
      minSampleSize: this.positiveIntegerOrDefault(
        policy.minSampleSize,
        DEFAULT_POLICY.minSampleSize
      ),
      clusterSize: Math.min(
        EUROPEAN_WHEEL_ORDER.length,
        this.positiveIntegerOrDefault(
          policy.clusterSize,
          DEFAULT_POLICY.clusterSize
        )
      ),
      candidateRatioThreshold:
        typeof policy.candidateRatioThreshold === 'number'
          ? policy.candidateRatioThreshold
          : DEFAULT_POLICY.candidateRatioThreshold,
      weakRatioThreshold:
        typeof policy.weakRatioThreshold === 'number'
          ? policy.weakRatioThreshold
          : DEFAULT_POLICY.weakRatioThreshold,
      maxRecords: this.positiveIntegerOrDefault(
        policy.maxRecords,
        DEFAULT_POLICY.maxRecords
      )
    };
  }

  private positiveIntegerOrDefault(
    value: number | undefined,
    fallback: number
  ): number {
    if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
      return fallback;
    }

    return value;
  }
