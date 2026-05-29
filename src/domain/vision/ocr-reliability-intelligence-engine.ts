export type OcrReliabilityState =
  | 'INSUFFICIENT_SAMPLE'
  | 'RELIABLE'
  | 'DEGRADED'
  | 'UNSTABLE'
  | 'REJECTED';

export type OcrReliabilityGate = 'BLOCKED';

export interface OcrReliabilityFrame {
  readonly frameId: string;
  readonly timestamp: number;
  readonly extractedValues: readonly number[];
  readonly confidence: number;
  readonly rejectedValues?: readonly number[];
  readonly visualDriftScore?: number;
  readonly blurScore?: number;
  readonly duplicatePressure?: number;
}

export interface OcrReliabilityInput {
  readonly sessionId?: string;
  readonly expectedCount?: number;
  readonly frames: readonly OcrReliabilityFrame[];
}

export interface OcrReliabilityReport {
  readonly sessionId: string;
  readonly state: OcrReliabilityState;
  readonly framesObserved: number;
  readonly valuesObserved: number;
  readonly completenessScore: number;
  readonly confidenceScore: number;
  readonly rejectionPressure: number;
  readonly visualInstabilityScore: number;
  readonly duplicatePressure: number;
  readonly reliabilityScore: number;
  readonly canUseForWarmup: boolean;
  readonly canUseForRuntime: boolean;
  readonly requiresManualReview: boolean;
  readonly gate: OcrReliabilityGate;
  readonly operationalGate: OcrReliabilityGate;
  readonly paperSessionGate: OcrReliabilityGate;
  readonly liveSessionGate: OcrReliabilityGate;
  readonly liveMoneyAuthorized: false;
  readonly reasons: readonly string[];
}

const DEFAULT_EXPECTED_COUNT = 100;
const MAX_FRAMES = 120;

export class OcrReliabilityIntelligenceEngine {
  public evaluate(input: OcrReliabilityInput): OcrReliabilityReport {
    this.assertInput(input);

    const sessionId = this.resolveId(input.sessionId, 'ocr-reliability-session');
    const expectedCount = this.expectedCount(input.expectedCount);
    const frames = input.frames.slice(0, MAX_FRAMES);

    let valuesObserved = 0;
    let rejectedObserved = 0;
    let confidenceSum = 0;
    let visualInstabilitySum = 0;
    let duplicatePressureSum = 0;
    let previousTimestamp = Number.NEGATIVE_INFINITY;
    let integrityPenalty = input.frames.length > MAX_FRAMES ? 8 : 0;

    for (let index = 0; index < frames.length; index += 1) {
      const frame = frames[index];
      this.assertFrame(frame);

      if (frame.timestamp < previousTimestamp) {
        integrityPenalty += 8;
      }

      previousTimestamp = frame.timestamp;
      valuesObserved += frame.extractedValues.length;
      rejectedObserved += frame.rejectedValues?.length ?? 0;
      confidenceSum += this.score(frame.confidence, 0);
      visualInstabilitySum += this.visualInstability(frame);
      duplicatePressureSum += this.score(frame.duplicatePressure, 0);
    }

    const framesObserved = frames.length;
    const confidenceScore = framesObserved === 0 ? 0 : this.clamp(confidenceSum / framesObserved, 0, 100);
    const completenessScore = this.clamp((valuesObserved / expectedCount) * 100, 0, 100);
    const rejectionPressure = this.clamp((rejectedObserved / expectedCount) * 100, 0, 100);
    const visualInstabilityScore = framesObserved === 0 ? 100 : this.clamp(visualInstabilitySum / framesObserved, 0, 100);
    const duplicatePressure = framesObserved === 0 ? 0 : this.clamp(duplicatePressureSum / framesObserved, 0, 100);

    const reliabilityScore = this.clamp(
      completenessScore * 0.34 +
        confidenceScore * 0.34 +
        (100 - rejectionPressure) * 0.12 +
        (100 - visualInstabilityScore) * 0.12 +
        (100 - duplicatePressure) * 0.08 -
        integrityPenalty,
      0,
      100
    );

    const state = this.classify(
      framesObserved,
      completenessScore,
      confidenceScore,
      rejectionPressure,
      visualInstabilityScore,
      duplicatePressure,
      reliabilityScore
    );

    return Object.freeze({
      sessionId,
      state,
      framesObserved,
      valuesObserved,
      completenessScore: this.round(completenessScore),
      confidenceScore: this.round(confidenceScore),
      rejectionPressure: this.round(rejectionPressure),
      visualInstabilityScore: this.round(visualInstabilityScore),
      duplicatePressure: this.round(duplicatePressure),
      reliabilityScore: this.round(reliabilityScore),
      canUseForWarmup: state === 'RELIABLE',
      canUseForRuntime: false,
      requiresManualReview: state !== 'RELIABLE',
      gate: 'BLOCKED',
      operationalGate: 'BLOCKED',
      paperSessionGate: 'BLOCKED',
      liveSessionGate: 'BLOCKED',
      liveMoneyAuthorized: false,
      reasons: this.reasonsFor(state, completenessScore, confidenceScore, rejectionPressure, visualInstabilityScore, duplicatePressure)
    });
  }

  public analyze(input: OcrReliabilityInput): OcrReliabilityReport {
    return this.evaluate(input);
  }

  public execute(input: OcrReliabilityInput): OcrReliabilityReport {
    return this.evaluate(input);
  }

  private classify(
    framesObserved: number,
    completenessScore: number,
    confidenceScore: number,
    rejectionPressure: number,
    visualInstabilityScore: number,
    duplicatePressure: number,
    reliabilityScore: number
  ): OcrReliabilityState {
    if (framesObserved === 0 || completenessScore < 20) {
      return 'INSUFFICIENT_SAMPLE';
    }

    if (
      reliabilityScore < 45 ||
      confidenceScore < 45 ||
      rejectionPressure >= 35 ||
      visualInstabilityScore >= 70
    ) {
      return 'REJECTED';
    }

    if (
      reliabilityScore < 65 ||
      confidenceScore < 65 ||
      visualInstabilityScore >= 48 ||
      duplicatePressure >= 45
    ) {
      return 'UNSTABLE';
    }

    if (
      reliabilityScore < 82 ||
      completenessScore < 98 ||
      confidenceScore < 90 ||
      rejectionPressure >= 5
    ) {
      return 'DEGRADED';
    }

    return 'RELIABLE';
  }

  private reasonsFor(
    state: OcrReliabilityState,
    completenessScore: number,
    confidenceScore: number,
    rejectionPressure: number,
    visualInstabilityScore: number,
    duplicatePressure: number
  ): readonly string[] {
    const reasons: string[] = [`OCR_RELIABILITY_STATE:${state}`];

    if (completenessScore < 98) reasons.push('OCR_COMPLETENESS_BELOW_INSTITUTIONAL_THRESHOLD');
    if (confidenceScore < 90) reasons.push('OCR_CONFIDENCE_BELOW_INSTITUTIONAL_THRESHOLD');
    if (rejectionPressure >= 5) reasons.push('OCR_REJECTION_PRESSURE_DETECTED');
    if (visualInstabilityScore >= 48) reasons.push('OCR_VISUAL_INSTABILITY_DETECTED');
    if (duplicatePressure >= 45) reasons.push('OCR_DUPLICATE_PRESSURE_DETECTED');

    reasons.push('LIVE_MONEY_AUTHORIZATION:FALSE');
    reasons.push('OPERATIONAL_GATE:BLOCKED');

    return Object.freeze(reasons);
  }

  private visualInstability(frame: OcrReliabilityFrame): number {
    return this.clamp(
      this.score(frame.visualDriftScore, 0) * 0.55 +
        this.score(frame.blurScore, 0) * 0.45,
      0,
      100
    );
  }

  private assertInput(input: OcrReliabilityInput): void {
    if (!Array.isArray(input.frames)) {
      throw new Error('INVALID_OCR_RELIABILITY_FRAMES');
    }
  }

  private assertFrame(frame: OcrReliabilityFrame): void {
    if (typeof frame.frameId !== 'string' || frame.frameId.trim().length === 0) {
      throw new Error('INVALID_OCR_RELIABILITY_FRAME_ID');
    }

    if (!Number.isFinite(frame.timestamp) || frame.timestamp < 0) {
      throw new Error('INVALID_OCR_RELIABILITY_TIMESTAMP');
    }

    if (!Array.isArray(frame.extractedValues)) {
      throw new Error('INVALID_OCR_RELIABILITY_VALUES');
    }

    for (const value of frame.extractedValues) {
      if (!Number.isInteger(value) || value < 0 || value > 36) {
        throw new Error('INVALID_OCR_RELIABILITY_ROULETTE_VALUE');
      }
    }

    if (!Number.isFinite(frame.confidence) || frame.confidence < 0 || frame.confidence > 100) {
      throw new Error('INVALID_OCR_RELIABILITY_CONFIDENCE');
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
