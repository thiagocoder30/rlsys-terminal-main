export type SpatialClusterCorrelationStatus =
  | 'CLUSTER_CORRELATION_CANDIDATE'
  | 'WEAK_CORRELATION'
  | 'INCONCLUSIVE'
  | 'BLOCKED';

export interface SpatialClusterRecord {
  readonly rouletteNumber: number;
  readonly dealerId?: string;
  readonly regime?: string;
  readonly frameIndex?: number;
}

export interface SpatialClusterCorrelationPolicy {
  readonly minSampleSize: number;
  readonly maxRecords: number;
  readonly minDominantClusterRatio: number;
  readonly minLiftOverBaseline: number;
}

export interface SpatialClusterContextReport {
  readonly contextKey: string;
  readonly totalRecords: number;
  readonly dominantCluster: number;
  readonly dominantClusterHits: number;
  readonly dominantClusterRatio: number;
  readonly liftOverBaseline: number;
}

export interface SpatialClusterCorrelationReport {
  readonly status: SpatialClusterCorrelationStatus;
  readonly totalRecords: number;
  readonly evaluatedContexts: number;
  readonly strongestContext: SpatialClusterContextReport | null;
  readonly averageDominantRatio: number;
  readonly checksum: string;
  readonly reason: string;
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

const ROULETTE_MIN = 0;
const ROULETTE_MAX = 36;
const CLUSTER_COUNT = 8;

const DEFAULT_POLICY: SpatialClusterCorrelationPolicy = {
  minSampleSize: 120,
  maxRecords: 10000,
  minDominantClusterRatio: 0.32,
  minLiftOverBaseline: 0.12
};

interface MutableContextBucket {
  readonly contextKey: string;
  totalRecords: number;
  readonly clusterHits: number[];
}

/**
 * Research-only engine for detecting spatial cluster correlations.
 *
 * The engine is intentionally framework-free and deterministic. It aggregates
 * roulette outcomes into physical wheel clusters and then evaluates whether a
 * context such as dealer/regime repeatedly favors a specific cluster beyond a
 * uniform baseline.
 */
export class SpatialClusterCorrelationEngine {
  public evaluate(
    records: readonly SpatialClusterRecord[],
    policy: Partial<SpatialClusterCorrelationPolicy> = {}
  ): Result<SpatialClusterCorrelationReport> {
    try {
      if (!Array.isArray(records)) {
        return { ok: false, error: 'INVALID_RECORDS' };
      }

      const effectivePolicy = this.mergePolicy(policy);
      const policyValidation = this.validatePolicy(effectivePolicy);

      if (!policyValidation.ok) {
        return policyValidation;
      }

      if (records.length > effectivePolicy.maxRecords) {
        return {
          ok: true,
          value: this.blockedReport(
            records.length,
            'MAX_RECORD_LIMIT_EXCEEDED'
          )
        };
      }

      if (records.length < effectivePolicy.minSampleSize) {
        return {
          ok: true,
          value: this.blockedReport(
            records.length,
            'INSUFFICIENT_SAMPLE'
          )
        };
      }

      const contexts = new Map<string, MutableContextBucket>();

      for (let index = 0; index < records.length; index += 1) {
        const record = records[index];

        if (!this.isValidRouletteNumber(record.rouletteNumber)) {
          return { ok: false, error: 'INVALID_ROULETTE_NUMBER' };
        }

        const contextKey = this.buildContextKey(record);
        const cluster = this.toWheelCluster(record.rouletteNumber);
        let bucket = contexts.get(contextKey);

        if (!bucket) {
          bucket = {
            contextKey,
            totalRecords: 0,
            clusterHits: Array.from({ length: CLUSTER_COUNT }, () => 0)
          };

          contexts.set(contextKey, bucket);
        }

        bucket.totalRecords += 1;
        bucket.clusterHits[cluster] += 1;
      }

      let strongestContext: SpatialClusterContextReport | null = null;
      let ratioSum = 0;
      let evaluatedContexts = 0;

      for (const bucket of contexts.values()) {
        if (bucket.totalRecords < effectivePolicy.minSampleSize) {
          continue;
        }

        const report = this.summarizeContext(bucket);
        ratioSum += report.dominantClusterRatio;
        evaluatedContexts += 1;

        if (
          strongestContext === null ||
          report.liftOverBaseline > strongestContext.liftOverBaseline ||
          (report.liftOverBaseline === strongestContext.liftOverBaseline &&
            report.contextKey < strongestContext.contextKey)
        ) {
          strongestContext = report;
        }
      }

      if (evaluatedContexts === 0 || strongestContext === null) {
        return {
          ok: true,
          value: {
            status: 'INCONCLUSIVE',
            totalRecords: records.length,
            evaluatedContexts,
            strongestContext: null,
            averageDominantRatio: 0,
            checksum: this.checksum(`INCONCLUSIVE|${records.length}|0`),
            reason: 'NO_CONTEXT_REACHED_MINIMUM_SAMPLE'
          }
        };
      }

      const averageDominantRatio = ratioSum / evaluatedContexts;
      const candidate =
        strongestContext.dominantClusterRatio >=
          effectivePolicy.minDominantClusterRatio &&
        strongestContext.liftOverBaseline >= effectivePolicy.minLiftOverBaseline;

      if (candidate) {
        return {
          ok: true,
          value: {
            status: 'CLUSTER_CORRELATION_CANDIDATE',
            totalRecords: records.length,
            evaluatedContexts,
            strongestContext,
            averageDominantRatio,
            checksum: this.reportChecksum(
              'CLUSTER_CORRELATION_CANDIDATE',
              records.length,
              evaluatedContexts,
              strongestContext,
              averageDominantRatio
            ),
            reason: 'PERSISTENT_CONTEXTUAL_CLUSTER_CORRELATION'
          }
        };
      }

      return {
        ok: true,
        value: {
          status: strongestContext.liftOverBaseline > 0 ? 'WEAK_CORRELATION' : 'INCONCLUSIVE',
          totalRecords: records.length,
          evaluatedContexts,
          strongestContext,
          averageDominantRatio,
          checksum: this.reportChecksum(
            strongestContext.liftOverBaseline > 0 ? 'WEAK_CORRELATION' : 'INCONCLUSIVE',
            records.length,
            evaluatedContexts,
            strongestContext,
            averageDominantRatio
          ),
          reason: 'NO_STRONG_CLUSTER_CORRELATION'
        }
      };
    } catch {
      return { ok: false, error: 'SPATIAL_CLUSTER_CORRELATION_FAILURE' };
    }
  }

  private mergePolicy(
    policy: Partial<SpatialClusterCorrelationPolicy>
  ): SpatialClusterCorrelationPolicy {
    return {
      minSampleSize: policy.minSampleSize ?? DEFAULT_POLICY.minSampleSize,
      maxRecords: policy.maxRecords ?? DEFAULT_POLICY.maxRecords,
      minDominantClusterRatio:
        policy.minDominantClusterRatio ?? DEFAULT_POLICY.minDominantClusterRatio,
      minLiftOverBaseline:
        policy.minLiftOverBaseline ?? DEFAULT_POLICY.minLiftOverBaseline
    };
  }

  private validatePolicy(
    policy: SpatialClusterCorrelationPolicy
  ): Result<true> {
    if (!Number.isInteger(policy.minSampleSize) || policy.minSampleSize <= 0) {
      return { ok: false, error: 'INVALID_MIN_SAMPLE_SIZE' };
    }

    if (!Number.isInteger(policy.maxRecords) || policy.maxRecords < policy.minSampleSize) {
      return { ok: false, error: 'INVALID_MAX_RECORDS' };
    }

    if (
      !Number.isFinite(policy.minDominantClusterRatio) ||
      policy.minDominantClusterRatio <= 0 ||
      policy.minDominantClusterRatio > 1
    ) {
      return { ok: false, error: 'INVALID_DOMINANT_CLUSTER_RATIO' };
    }

    if (
      !Number.isFinite(policy.minLiftOverBaseline) ||
      policy.minLiftOverBaseline < 0 ||
      policy.minLiftOverBaseline > 1
    ) {
      return { ok: false, error: 'INVALID_LIFT_THRESHOLD' };
    }

    return { ok: true, value: true };
  }
