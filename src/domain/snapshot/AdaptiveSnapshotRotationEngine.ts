export type AdaptiveSnapshotRotationVerdict =
  | 'SNAPSHOT_RETAINED'
  | 'SNAPSHOT_ROTATED'
  | 'SNAPSHOT_REVIEW'
  | 'SNAPSHOT_BLOCKED';

export type AdaptiveSnapshotStatus =
  | 'VALID'
  | 'REVIEW'
  | 'REVOKED'
  | 'EXPIRED'
  | 'BLOCKED';

export interface RuntimeSnapshotCandidate {
  readonly snapshotId: string;
  readonly status: AdaptiveSnapshotStatus;
  readonly entropyDrift: number;
  readonly dealerDrift: number;
  readonly runtimeDegradation: number;
  readonly confidence: number;
  readonly generatedAtEpochMs: number;
}

export interface AdaptiveSnapshotRotationPolicy {
  readonly maxEntropyDrift: number;
  readonly maxDealerDrift: number;
  readonly maxRuntimeDegradation: number;
  readonly minConfidence: number;
  readonly maxSnapshotAgeMs: number;
}

export interface AdaptiveSnapshotRotationDecision {
  readonly verdict: AdaptiveSnapshotRotationVerdict;
  readonly activeSnapshotId: string | null;
  readonly previousSnapshotId: string | null;
  readonly reason: string;
  readonly evaluatedCandidates: number;
}

/**
 * Selects the safest available snapshot using bounded O(n) scoring.
 *
 * The engine never loads statistical models. It only evaluates compact metadata,
 * making it safe for mobile runtime operation under memory pressure.
 */
export class AdaptiveSnapshotRotationEngine {
  public constructor(
    private readonly policy: AdaptiveSnapshotRotationPolicy = {
      maxEntropyDrift: 0.25,
      maxDealerDrift: 0.25,
      maxRuntimeDegradation: 0.30,
      minConfidence: 0.80,
      maxSnapshotAgeMs: 1000 * 60 * 60 * 24,
    },
  ) {}

  public rotate(
    current: RuntimeSnapshotCandidate | null,
    candidates: readonly RuntimeSnapshotCandidate[],
    nowEpochMs: number = Date.now(),
  ): AdaptiveSnapshotRotationDecision {
    if (current !== null && this.isUsable(current, nowEpochMs)) {
      return {
        verdict: 'SNAPSHOT_RETAINED',
        activeSnapshotId: current.snapshotId,
        previousSnapshotId: current.snapshotId,
        reason: 'current snapshot remains within operational policy',
        evaluatedCandidates: candidates.length,
      };
    }

    const replacement = this.selectBestCandidate(candidates, nowEpochMs);

    if (replacement === null) {
      return {
        verdict: 'SNAPSHOT_BLOCKED',
        activeSnapshotId: null,
        previousSnapshotId: current?.snapshotId ?? null,
        reason: 'no usable replacement snapshot available',
        evaluatedCandidates: candidates.length,
      };
    }

    return {
      verdict: current === null ? 'SNAPSHOT_REVIEW' : 'SNAPSHOT_ROTATED',
      activeSnapshotId: replacement.snapshotId,
      previousSnapshotId: current?.snapshotId ?? null,
      reason: current === null
        ? 'snapshot selected for review from candidate pool'
        : 'current snapshot unsafe; rotated to best candidate',
      evaluatedCandidates: candidates.length,
    };
  }

  private selectBestCandidate(
    candidates: readonly RuntimeSnapshotCandidate[],
    nowEpochMs: number,
  ): RuntimeSnapshotCandidate | null {
    let selected: RuntimeSnapshotCandidate | null = null;
    let selectedScore = Number.NEGATIVE_INFINITY;

    for (const candidate of candidates) {
      if (!this.isUsable(candidate, nowEpochMs)) {
        continue;
      }

      const score = this.score(candidate);

      if (score > selectedScore) {
        selected = candidate;
        selectedScore = score;
      }
    }

    return selected;
  }

  private isUsable(candidate: RuntimeSnapshotCandidate, nowEpochMs: number): boolean {
    const ageMs = Math.max(0, nowEpochMs - candidate.generatedAtEpochMs);

    return (
      candidate.status === 'VALID' &&
      candidate.confidence >= this.policy.minConfidence &&
      candidate.entropyDrift <= this.policy.maxEntropyDrift &&
      candidate.dealerDrift <= this.policy.maxDealerDrift &&
      candidate.runtimeDegradation <= this.policy.maxRuntimeDegradation &&
      ageMs <= this.policy.maxSnapshotAgeMs
    );
  }

  private score(candidate: RuntimeSnapshotCandidate): number {
    const driftPenalty =
      candidate.entropyDrift +
      candidate.dealerDrift +
      candidate.runtimeDegradation;

    return candidate.confidence - driftPenalty;
  }
}
