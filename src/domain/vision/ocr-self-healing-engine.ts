export type OcrReliabilityState =
  | 'INSUFFICIENT_SAMPLE'
  | 'RELIABLE'
  | 'DEGRADED'
  | 'UNSTABLE'
  | 'REJECTED';

export type OcrFusionState =
  | 'INSUFFICIENT_SAMPLE'
  | 'STABLE'
  | 'DEGRADED'
  | 'CONFLICTED'
  | 'REJECTED';

export type OcrSelfHealingState =
  | 'HEALTHY'
  | 'RETRY_RECOMMENDED'
  | 'RECALIBRATE'
  | 'RECAPTURE_REQUIRED'
  | 'MANUAL_REVIEW_REQUIRED'
  | 'LOCKED';

export type OcrSelfHealingAction =
  | 'ACCEPT_FOR_WARMUP_REVIEW'
  | 'RETRY_OCR_EXTRACTION'
  | 'RECALIBRATE_REGION_OF_INTEREST'
  | 'RECAPTURE_VISUAL_FRAME'
  | 'REQUIRE_MANUAL_REVIEW'
  | 'LOCK_OCR_PIPELINE';

export type OcrSelfHealingGate = 'BLOCKED';

export interface OcrSelfHealingInput {
  readonly sessionId?: string;
  readonly reliabilityState?: OcrReliabilityState;
  readonly fusionState?: OcrFusionState;
  readonly reliabilityScore?: number;
  readonly fusionConfidenceScore?: number;
  readonly completenessScore?: number;
  readonly conflictScore?: number;
  readonly contestedPositionRatio?: number;
  readonly visualPenaltyScore?: number;
  readonly rejectionPressure?: number;
  readonly retryAttempts?: number;
  readonly consecutiveFailures?: number;
  readonly expectedCount?: number;
  readonly lastAcceptedCount?: number;
}

interface NormalizedOcrSelfHealingInput {
  readonly sessionId: string;
  readonly reliabilityState: OcrReliabilityState;
  readonly fusionState: OcrFusionState;
  readonly reliabilityScore: number;
  readonly fusionConfidenceScore: number;
  readonly completenessScore: number;
  readonly conflictScore: number;
  readonly contestedPositionRatio: number;
  readonly visualPenaltyScore: number;
  readonly rejectionPressure: number;
  readonly retryAttempts: number;
  readonly consecutiveFailures: number;
  readonly expectedCount: number;
  readonly lastAcceptedCount: number;
}

export interface OcrSelfHealingReport {
  readonly sessionId: string;
  readonly state: OcrSelfHealingState;
  readonly actions: readonly OcrSelfHealingAction[];
  readonly healingPriorityScore: number;
  readonly retryBudgetRemaining: number;
  readonly canRetry: boolean;
  readonly shouldRecalibrate: boolean;
  readonly shouldRecapture: boolean;
  readonly requiresManualReview: boolean;
  readonly canUseForWarmup: boolean;
  readonly canUseForRuntime: boolean;
  readonly gate: OcrSelfHealingGate;
  readonly operationalGate: OcrSelfHealingGate;
  readonly paperSessionGate: OcrSelfHealingGate;
  readonly liveSessionGate: OcrSelfHealingGate;
  readonly liveMoneyAuthorized: false;
  readonly reasons: readonly string[];
}

const MAX_RETRY_ATTEMPTS = 3;
const DEFAULT_EXPECTED_COUNT = 100;

export class OcrSelfHealingEngine {
  public evaluate(input: OcrSelfHealingInput): OcrSelfHealingReport {
    const normalized = this.normalize(input);

    const healingPriorityScore = this.calculateHealingPriority(normalized);
    const state = this.classify(normalized, healingPriorityScore);
    const actions = this.actionsFor(state);

    const retryBudgetRemaining = Math.max(
      0,
      MAX_RETRY_ATTEMPTS - normalized.retryAttempts
    );

    return Object.freeze({
      sessionId: normalized.sessionId,
      state,
      actions,
      healingPriorityScore: this.round(healingPriorityScore),
      retryBudgetRemaining,
      canRetry:
        state === 'RETRY_RECOMMENDED' &&
        retryBudgetRemaining > 0,
      shouldRecalibrate:
        state === 'RECALIBRATE',
      shouldRecapture:
        state === 'RECAPTURE_REQUIRED',
      requiresManualReview:
        state === 'MANUAL_REVIEW_REQUIRED' ||
        state === 'LOCKED',
      canUseForWarmup:
        state === 'HEALTHY',
      canUseForRuntime: false,
      gate: 'BLOCKED',
      operationalGate: 'BLOCKED',
      paperSessionGate: 'BLOCKED',
      liveSessionGate: 'BLOCKED',
      liveMoneyAuthorized: false,
      reasons: this.reasonsFor(normalized, state, healingPriorityScore)
    });
  }

  public analyze(input: OcrSelfHealingInput): OcrSelfHealingReport {
    return this.evaluate(input);
  }

  public execute(input: OcrSelfHealingInput): OcrSelfHealingReport {
    return this.evaluate(input);
  }

  private calculateHealingPriority(
    input: NormalizedOcrSelfHealingInput
  ): number {
    const missingCompletenessPressure =
      Math.max(0, 100 - input.completenessScore);

    return this.clamp(
      missingCompletenessPressure * 0.16 +
        Math.max(0, 100 - input.reliabilityScore) * 0.18 +
        Math.max(0, 100 - input.fusionConfidenceScore) * 0.18 +
        input.conflictScore * 0.13 +
        input.contestedPositionRatio * 0.12 +
        input.visualPenaltyScore * 0.12 +
        input.rejectionPressure * 0.11 +
        input.retryAttempts * 5 +
        input.consecutiveFailures * 12,
      0,
      100
    );
  }

  private classify(
    input: NormalizedOcrSelfHealingInput,
    healingPriorityScore: number
  ): OcrSelfHealingState {
    if (
      input.consecutiveFailures >= 3 ||
      input.retryAttempts >= MAX_RETRY_ATTEMPTS ||
      input.reliabilityState === 'REJECTED' ||
      input.fusionState === 'REJECTED'
    ) {
      return 'LOCKED';
    }

    if (
      input.reliabilityState === 'INSUFFICIENT_SAMPLE' ||
      input.fusionState === 'INSUFFICIENT_SAMPLE' ||
      input.lastAcceptedCount < Math.floor(input.expectedCount * 0.2)
    ) {
      return 'MANUAL_REVIEW_REQUIRED';
    }

    if (
      input.visualPenaltyScore >= 62 ||
      input.rejectionPressure >= 22 ||
      input.completenessScore < 70
    ) {
      return 'RECAPTURE_REQUIRED';
    }

    if (
      input.fusionState === 'CONFLICTED' ||
      input.conflictScore >= 18 ||
      input.contestedPositionRatio >= 25
    ) {
      return 'RECALIBRATE';
    }

    if (
      input.reliabilityState === 'DEGRADED' ||
      input.reliabilityState === 'UNSTABLE' ||
      input.fusionState === 'DEGRADED' ||
      healingPriorityScore >= 28
    ) {
      return 'RETRY_RECOMMENDED';
    }

    return 'HEALTHY';
  }

  private actionsFor(state: OcrSelfHealingState): readonly OcrSelfHealingAction[] {
    switch (state) {
      case 'HEALTHY':
        return Object.freeze(['ACCEPT_FOR_WARMUP_REVIEW']);
      case 'RETRY_RECOMMENDED':
        return Object.freeze(['RETRY_OCR_EXTRACTION']);
      case 'RECALIBRATE':
        return Object.freeze([
          'RECALIBRATE_REGION_OF_INTEREST',
          'RETRY_OCR_EXTRACTION'
        ]);
      case 'RECAPTURE_REQUIRED':
        return Object.freeze([
          'RECAPTURE_VISUAL_FRAME',
          'RETRY_OCR_EXTRACTION'
        ]);
      case 'MANUAL_REVIEW_REQUIRED':
        return Object.freeze(['REQUIRE_MANUAL_REVIEW']);
      case 'LOCKED':
        return Object.freeze([
          'LOCK_OCR_PIPELINE',
          'REQUIRE_MANUAL_REVIEW'
        ]);
    }
  }

  private reasonsFor(
    input: NormalizedOcrSelfHealingInput,
    state: OcrSelfHealingState,
    healingPriorityScore: number
  ): readonly string[] {
    const reasons: string[] = [`OCR_SELF_HEALING_STATE:${state}`];

    if (input.reliabilityState === 'REJECTED') reasons.push('OCR_RELIABILITY_REJECTED');
    if (input.fusionState === 'REJECTED') reasons.push('OCR_FUSION_REJECTED');
    if (input.fusionState === 'CONFLICTED') reasons.push('OCR_FUSION_CONFLICTED');
    if (input.visualPenaltyScore >= 62) reasons.push('OCR_VISUAL_RECAPTURE_PRESSURE');
    if (input.rejectionPressure >= 22) reasons.push('OCR_REJECTION_RECAPTURE_PRESSURE');
    if (input.conflictScore >= 18) reasons.push('OCR_CONFLICT_RECALIBRATION_PRESSURE');
    if (input.contestedPositionRatio >= 25) reasons.push('OCR_CONTESTED_POSITION_RECALIBRATION_PRESSURE');
    if (input.retryAttempts >= MAX_RETRY_ATTEMPTS) reasons.push('OCR_RETRY_BUDGET_EXHAUSTED');
    if (input.consecutiveFailures >= 3) reasons.push('OCR_CONSECUTIVE_FAILURE_LOCK');
    if (healingPriorityScore >= 28) reasons.push('OCR_HEALING_PRIORITY_THRESHOLD_EXCEEDED');

    reasons.push('LIVE_MONEY_AUTHORIZATION:FALSE');
    reasons.push('OPERATIONAL_GATE:BLOCKED');

    return Object.freeze(reasons);
  }

  private normalize(input: OcrSelfHealingInput): NormalizedOcrSelfHealingInput {
    const expectedCount =
      typeof input.expectedCount === 'number' &&
      Number.isFinite(input.expectedCount) &&
      input.expectedCount > 0
        ? Math.floor(input.expectedCount)
        : DEFAULT_EXPECTED_COUNT;

    return Object.freeze({
      sessionId: this.resolveId(input.sessionId, 'ocr-self-healing-session'),
      reliabilityState: this.normalizeReliability(input.reliabilityState),
      fusionState: this.normalizeFusion(input.fusionState),
      reliabilityScore: this.score(input.reliabilityScore, 0),
      fusionConfidenceScore: this.score(input.fusionConfidenceScore, 0),
      completenessScore: this.score(input.completenessScore, 0),
      conflictScore: this.score(input.conflictScore, 0),
      contestedPositionRatio: this.score(input.contestedPositionRatio, 0),
      visualPenaltyScore: this.score(input.visualPenaltyScore, 0),
      rejectionPressure: this.score(input.rejectionPressure, 0),
      retryAttempts: this.nonNegativeInteger(input.retryAttempts),
      consecutiveFailures: this.nonNegativeInteger(input.consecutiveFailures),
      expectedCount,
      lastAcceptedCount: this.nonNegativeInteger(input.lastAcceptedCount)
    });
  }

  private normalizeReliability(
    value: OcrReliabilityState | undefined
  ): OcrReliabilityState {
    switch (value) {
      case 'INSUFFICIENT_SAMPLE':
      case 'RELIABLE':
      case 'DEGRADED':
      case 'UNSTABLE':
      case 'REJECTED':
        return value;
      default:
        return 'INSUFFICIENT_SAMPLE';
    }
  }

  private normalizeFusion(
    value: OcrFusionState | undefined
  ): OcrFusionState {
    switch (value) {
      case 'INSUFFICIENT_SAMPLE':
      case 'STABLE':
      case 'DEGRADED':
      case 'CONFLICTED':
      case 'REJECTED':
        return value;
      default:
        return 'INSUFFICIENT_SAMPLE';
    }
  }

  private resolveId(value: string | undefined, fallback: string): string {
    return typeof value === 'string' && value.trim().length > 0
      ? value.trim()
      : fallback;
  }

  private score(value: number | undefined, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value)
      ? this.round(this.clamp(value, 0, 100))
      : fallback;
  }

  private nonNegativeInteger(value: number | undefined): number {
    return typeof value === 'number' && Number.isFinite(value) && value > 0
      ? Math.floor(value)
      : 0;
  }

  private clamp(value: number, minimum: number, maximum: number): number {
    return Math.min(maximum, Math.max(minimum, value));
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
