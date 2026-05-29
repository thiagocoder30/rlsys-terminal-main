export type ConfidenceAwareOcrFusionState =
  | 'INSUFFICIENT_SAMPLE'
  | 'STABLE'
  | 'DEGRADED'
  | 'CONFLICTED'
  | 'REJECTED';

export type ConfidenceAwareOcrFusionGate = 'BLOCKED';

export interface ConfidenceAwareOcrFusionFrame {
  readonly frameId: string;
  readonly timestamp: number;
  readonly extractedValues: readonly number[];
  readonly confidence: number;
  readonly visualDriftScore?: number;
  readonly blurScore?: number;
  readonly rejectedValues?: readonly number[];
}

export interface ConfidenceAwareOcrFusionInput {
  readonly sessionId?: string;
  readonly expectedCount?: number;
  readonly frames: readonly ConfidenceAwareOcrFusionFrame[];
}

interface CandidateAccumulator {
  readonly value: number;
  weight: number;
  count: number;
}

export interface ConfidenceAwareOcrFusionReport {
  readonly sessionId: string;
  readonly state: ConfidenceAwareOcrFusionState;
  readonly framesObserved: number;
  readonly fusedValues: readonly number[];
  readonly fusedCount: number;
  readonly completenessScore: number;
  readonly averageFrameConfidence: number;
  readonly fusionConfidenceScore: number;
  readonly conflictScore: number;
  readonly contestedPositionRatio: number;
  readonly visualPenaltyScore: number;
  readonly rejectionPressure: number;
  readonly canUseForWarmup: boolean;
  readonly canUseForRuntime: boolean;
  readonly requiresManualReview: boolean;
  readonly gate: ConfidenceAwareOcrFusionGate;
  readonly operationalGate: ConfidenceAwareOcrFusionGate;
  readonly paperSessionGate: ConfidenceAwareOcrFusionGate;
  readonly liveSessionGate: ConfidenceAwareOcrFusionGate;
  readonly liveMoneyAuthorized: false;
  readonly reasons: readonly string[];
}

const DEFAULT_EXPECTED_COUNT = 100;
const MAX_FUSION_FRAMES = 20;

export class ConfidenceAwareOcrFusionEngine {
  public fuse(input: ConfidenceAwareOcrFusionInput): ConfidenceAwareOcrFusionReport {
    this.assertInput(input);

    const sessionId = this.resolveId(input.sessionId, 'confidence-aware-ocr-fusion-session');
    const expectedCount = this.expectedCount(input.expectedCount);
    const frames = input.frames.slice(0, MAX_FUSION_FRAMES);

    let confidenceSum = 0;
    let visualPenaltySum = 0;
    let rejectedValues = 0;
    let previousTimestamp = Number.NEGATIVE_INFINITY;
    let integrityPenalty = input.frames.length > MAX_FUSION_FRAMES ? 8 : 0;
    let maxPositions = 0;

    for (const frame of frames) {
      this.assertFrame(frame);

      if (frame.timestamp < previousTimestamp) {
        integrityPenalty += 8;
      }

      previousTimestamp = frame.timestamp;
      confidenceSum += frame.confidence;
      visualPenaltySum += this.visualPenalty(frame);
      rejectedValues += frame.rejectedValues?.length ?? 0;
      maxPositions = Math.max(maxPositions, frame.extractedValues.length);
    }

    const fusedValues: number[] = [];
    let conflictSum = 0;
    let fusionConfidenceSum = 0;
    let contestedPositions = 0;

    for (let position = 0; position < maxPositions; position += 1) {
      const candidates = new Map<number, CandidateAccumulator>();

      for (const frame of frames) {
        const value = frame.extractedValues[position];

        if (typeof value !== 'number') {
          continue;
        }

        const weight = this.frameWeight(frame);
        const current = candidates.get(value);

        if (current === undefined) {
          candidates.set(value, { value, weight, count: 1 });
        } else {
          current.weight += weight;
          current.count += 1;
        }
      }

      if (candidates.size === 0) {
        continue;
      }

      if (candidates.size > 1) {
        contestedPositions += 1;
      }

      let totalWeight = 0;
      let winner: CandidateAccumulator | undefined;

      for (const candidate of candidates.values()) {
        totalWeight += candidate.weight;

        if (winner === undefined || candidate.weight > winner.weight) {
          winner = candidate;
        }
      }

      if (winner === undefined || totalWeight <= 0) {
        continue;
      }

      fusedValues.push(winner.value);

      const localConfidence = this.clamp((winner.weight / totalWeight) * 100, 0, 100);
      const localConflict = candidates.size > 1
        ? this.clamp(100 - localConfidence, 0, 100)
        : 0;

      fusionConfidenceSum += localConfidence;
      conflictSum += localConflict;
    }

    const framesObserved = frames.length;
    const fusedCount = fusedValues.length;
    const completenessScore = this.clamp((fusedCount / expectedCount) * 100, 0, 100);
    const averageFrameConfidence = framesObserved === 0 ? 0 : this.clamp(confidenceSum / framesObserved, 0, 100);
    const visualPenaltyScore = framesObserved === 0 ? 100 : this.clamp(visualPenaltySum / framesObserved, 0, 100);
    const rejectionPressure = this.clamp((rejectedValues / expectedCount) * 100, 0, 100);
    const conflictScore = fusedCount === 0 ? 100 : this.clamp(conflictSum / fusedCount, 0, 100);
    const contestedPositionRatio = fusedCount === 0 ? 100 : this.clamp((contestedPositions / fusedCount) * 100, 0, 100);

    const fusionConfidenceScore = this.clamp(
      (fusedCount === 0 ? 0 : fusionConfidenceSum / fusedCount) -
        visualPenaltyScore * 0.25 -
        rejectionPressure * 0.35 -
        contestedPositionRatio * 0.18 -
        integrityPenalty,
      0,
      100
    );

    const state = this.classify(
      framesObserved,
      completenessScore,
      averageFrameConfidence,
      fusionConfidenceScore,
      conflictScore,
      contestedPositionRatio,
      visualPenaltyScore,
      rejectionPressure
    );

    return Object.freeze({
      sessionId,
      state,
      framesObserved,
      fusedValues: Object.freeze(fusedValues),
      fusedCount,
      completenessScore: this.round(completenessScore),
      averageFrameConfidence: this.round(averageFrameConfidence),
      fusionConfidenceScore: this.round(fusionConfidenceScore),
      conflictScore: this.round(conflictScore),
      contestedPositionRatio: this.round(contestedPositionRatio),
      visualPenaltyScore: this.round(visualPenaltyScore),
      rejectionPressure: this.round(rejectionPressure),
      canUseForWarmup: state === 'STABLE',
      canUseForRuntime: false,
      requiresManualReview: state !== 'STABLE',
      gate: 'BLOCKED',
      operationalGate: 'BLOCKED',
      paperSessionGate: 'BLOCKED',
      liveSessionGate: 'BLOCKED',
      liveMoneyAuthorized: false,
      reasons: this.reasonsFor(state, completenessScore, fusionConfidenceScore, conflictScore, contestedPositionRatio, visualPenaltyScore, rejectionPressure)
    });
  }

  public evaluate(input: ConfidenceAwareOcrFusionInput): ConfidenceAwareOcrFusionReport {
    return this.fuse(input);
  }

  public execute(input: ConfidenceAwareOcrFusionInput): ConfidenceAwareOcrFusionReport {
    return this.fuse(input);
  }

  private classify(
    framesObserved: number,
    completenessScore: number,
    averageFrameConfidence: number,
    fusionConfidenceScore: number,
    conflictScore: number,
    contestedPositionRatio: number,
    visualPenaltyScore: number,
    rejectionPressure: number
  ): ConfidenceAwareOcrFusionState {
    if (framesObserved === 0 || completenessScore < 20) {
      return 'INSUFFICIENT_SAMPLE';
    }

    if (
      fusionConfidenceScore < 45 ||
      averageFrameConfidence < 45 ||
      conflictScore >= 50 ||
      contestedPositionRatio >= 80 ||
      visualPenaltyScore >= 72 ||
      rejectionPressure >= 35
    ) {
      return 'REJECTED';
    }

    if (
      conflictScore >= 16 ||
      contestedPositionRatio >= 25 ||
      visualPenaltyScore >= 52 ||
      fusionConfidenceScore < 68
    ) {
      return 'CONFLICTED';
    }

    if (
      completenessScore < 98 ||
      averageFrameConfidence < 90 ||
      fusionConfidenceScore < 86 ||
      rejectionPressure >= 5
    ) {
      return 'DEGRADED';
    }

    return 'STABLE';
  }

  private reasonsFor(
    state: ConfidenceAwareOcrFusionState,
    completenessScore: number,
    fusionConfidenceScore: number,
    conflictScore: number,
    contestedPositionRatio: number,
    visualPenaltyScore: number,
    rejectionPressure: number
  ): readonly string[] {
    const reasons: string[] = [`OCR_FUSION_STATE:${state}`];

    if (completenessScore < 98) reasons.push('OCR_FUSION_COMPLETENESS_BELOW_THRESHOLD');
    if (fusionConfidenceScore < 86) reasons.push('OCR_FUSION_CONFIDENCE_BELOW_THRESHOLD');
    if (conflictScore >= 16) reasons.push('OCR_FUSION_CONFLICT_DETECTED');
    if (contestedPositionRatio >= 25) reasons.push('OCR_FUSION_CONTESTED_POSITION_RATIO_DETECTED');
    if (visualPenaltyScore >= 52) reasons.push('OCR_FUSION_VISUAL_PENALTY_DETECTED');
    if (rejectionPressure >= 5) reasons.push('OCR_FUSION_REJECTION_PRESSURE_DETECTED');

    reasons.push('LIVE_MONEY_AUTHORIZATION:FALSE');
    reasons.push('OPERATIONAL_GATE:BLOCKED');

    return Object.freeze(reasons);
  }

  private frameWeight(frame: ConfidenceAwareOcrFusionFrame): number {
    return this.clamp(
      frame.confidence -
        this.score(frame.visualDriftScore, 0) * 0.35 -
        this.score(frame.blurScore, 0) * 0.25 -
        (frame.rejectedValues?.length ?? 0) * 0.8,
      0,
      100
    );
  }

  private visualPenalty(frame: ConfidenceAwareOcrFusionFrame): number {
    return this.clamp(
      this.score(frame.visualDriftScore, 0) * 0.58 +
        this.score(frame.blurScore, 0) * 0.42,
      0,
      100
    );
  }

  private assertInput(input: ConfidenceAwareOcrFusionInput): void {
    if (!Array.isArray(input.frames)) {
      throw new Error('INVALID_CONFIDENCE_AWARE_OCR_FUSION_FRAMES');
    }
  }

  private assertFrame(frame: ConfidenceAwareOcrFusionFrame): void {
    if (typeof frame.frameId !== 'string' || frame.frameId.trim().length === 0) {
      throw new Error('INVALID_CONFIDENCE_AWARE_OCR_FUSION_FRAME_ID');
    }

    if (!Number.isFinite(frame.timestamp) || frame.timestamp < 0) {
      throw new Error('INVALID_CONFIDENCE_AWARE_OCR_FUSION_TIMESTAMP');
    }

    if (!Array.isArray(frame.extractedValues)) {
      throw new Error('INVALID_CONFIDENCE_AWARE_OCR_FUSION_VALUES');
    }

    for (const value of frame.extractedValues) {
      if (!Number.isInteger(value) || value < 0 || value > 36) {
        throw new Error('INVALID_CONFIDENCE_AWARE_OCR_FUSION_ROULETTE_VALUE');
      }
    }

    if (!Number.isFinite(frame.confidence) || frame.confidence < 0 || frame.confidence > 100) {
      throw new Error('INVALID_CONFIDENCE_AWARE_OCR_FUSION_CONFIDENCE');
    }
  }

  private expectedCount(value: number | undefined): number {
    return typeof value === 'number' && Number.isFinite(value) && value > 0
      ? Math.floor(value)
      : DEFAULT_EXPECTED_COUNT;
  }

  private resolveId(value: string | undefined, fallback: string): string {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
  }

  private score(value: number | undefined, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value)
      ? this.clamp(value, 0, 100)
      : fallback;
  }

  private clamp(value: number, minimum: number, maximum: number): number {
    return Math.min(maximum, Math.max(minimum, value));
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
