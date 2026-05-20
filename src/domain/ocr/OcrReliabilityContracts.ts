export type OcrReliabilityVerdict =
  | 'OCR_ACCEPTED'
  | 'OCR_REVIEW'
  | 'OCR_REJECTED'
  | 'BLOCKED';

export interface OcrFrameReading {
  readonly frameId: string;
  readonly value: number;
  readonly confidence: number;
  readonly latencyMs: number;
  readonly capturedAtEpochMs: number;
}

export interface OcrReliabilityPolicy {
  readonly minFrames: number;
  readonly quorumRatio: number;
  readonly minConfidence: number;
  readonly maxLatencyMs: number;
}

export interface OcrReliabilityAssessment {
  readonly verdict: OcrReliabilityVerdict;
  readonly acceptedValue: number | null;
  readonly frameCount: number;
  readonly quorumCount: number;
  readonly averageConfidence: number;
  readonly maxLatencyMs: number;
  readonly reason: string;
}
