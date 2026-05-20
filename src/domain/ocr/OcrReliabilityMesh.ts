import {
  OcrFrameReading,
  OcrReliabilityAssessment,
  OcrReliabilityPolicy,
  OcrReliabilityVerdict,
} from './OcrReliabilityContracts';

const ROULETTE_MIN = 0;
const ROULETTE_MAX = 36;

/**
 * Defensive OCR consensus engine.
 *
 * Complexity:
 * - Time: O(n), where n is the number of OCR frames.
 * - Space: O(k), where k is the number of distinct roulette values, bounded by 37.
 *
 * It never guesses. It only accepts a value when quorum, confidence and latency
 * are inside the operational safety policy.
 */
export class OcrReliabilityMesh {
  public constructor(
    private readonly policy: OcrReliabilityPolicy = {
      minFrames: 3,
      quorumRatio: 0.67,
      minConfidence: 0.82,
      maxLatencyMs: 1500,
    },
  ) {}

  public assess(readings: readonly OcrFrameReading[]): OcrReliabilityAssessment {
    if (readings.length < this.policy.minFrames) {
      return this.block(
        'insufficient OCR frames for quorum',
        readings.length,
        0,
        0,
        0,
      );
    }

    const counters = new Map<number, number>();
    let confidenceSum = 0;
    let maxLatencyMs = 0;
    let validFrames = 0;

    for (const reading of readings) {
      if (!this.isValidReading(reading)) {
        continue;
      }

      validFrames += 1;
      confidenceSum += reading.confidence;
      maxLatencyMs = Math.max(maxLatencyMs, reading.latencyMs);
      counters.set(reading.value, (counters.get(reading.value) ?? 0) + 1);
    }

    if (validFrames < this.policy.minFrames) {
      return this.block(
        'insufficient valid OCR frames',
        validFrames,
        0,
        this.average(confidenceSum, validFrames),
        maxLatencyMs,
      );
    }

    const winner = this.findWinner(counters);
    const quorumCount = winner.count;
    const quorumRatio = quorumCount / validFrames;
    const averageConfidence = this.average(confidenceSum, validFrames);

    if (maxLatencyMs > this.policy.maxLatencyMs) {
      return this.review(
        'OCR latency exceeded operational policy',
        null,
        validFrames,
        quorumCount,
        averageConfidence,
        maxLatencyMs,
      );
    }

    if (averageConfidence < this.policy.minConfidence) {
      return this.review(
        'OCR confidence below operational policy',
        null,
        validFrames,
        quorumCount,
        averageConfidence,
        maxLatencyMs,
      );
    }

    if (quorumRatio < this.policy.quorumRatio) {
      return this.reject(
        'OCR quorum not reached',
        validFrames,
        quorumCount,
        averageConfidence,
        maxLatencyMs,
      );
    }

    return {
      verdict: 'OCR_ACCEPTED',
      acceptedValue: winner.value,
      frameCount: validFrames,
      quorumCount,
      averageConfidence,
      maxLatencyMs,
      reason: `OCR consensus accepted value ${winner.value}`,
    };
  }

  private isValidReading(reading: OcrFrameReading): boolean {
    return (
      Number.isInteger(reading.value) &&
      reading.value >= ROULETTE_MIN &&
      reading.value <= ROULETTE_MAX &&
      Number.isFinite(reading.confidence) &&
      reading.confidence >= 0 &&
      reading.confidence <= 1 &&
      Number.isFinite(reading.latencyMs) &&
      reading.latencyMs >= 0
    );
  }

  private findWinner(counters: ReadonlyMap<number, number>): {
    readonly value: number | null;
    readonly count: number;
  } {
    let selectedValue: number | null = null;
    let selectedCount = 0;

    for (const [value, count] of counters.entries()) {
      if (count > selectedCount) {
        selectedValue = value;
        selectedCount = count;
      }
    }

    return { value: selectedValue, count: selectedCount };
  }

  private average(total: number, count: number): number {
    return count > 0 ? total / count : 0;
  }

  private block(
    reason: string,
    frameCount: number,
    quorumCount: number,
    averageConfidence: number,
    maxLatencyMs: number,
  ): OcrReliabilityAssessment {
    return this.assessment('BLOCKED', null, frameCount, quorumCount, averageConfidence, maxLatencyMs, reason);
  }

  private review(
    reason: string,
    acceptedValue: number | null,
    frameCount: number,
    quorumCount: number,
    averageConfidence: number,
    maxLatencyMs: number,
  ): OcrReliabilityAssessment {
    return this.assessment('OCR_REVIEW', acceptedValue, frameCount, quorumCount, averageConfidence, maxLatencyMs, reason);
  }

  private reject(
    reason: string,
    frameCount: number,
    quorumCount: number,
    averageConfidence: number,
    maxLatencyMs: number,
  ): OcrReliabilityAssessment {
    return this.assessment('OCR_REJECTED', null, frameCount, quorumCount, averageConfidence, maxLatencyMs, reason);
  }

  private assessment(
    verdict: OcrReliabilityVerdict,
    acceptedValue: number | null,
    frameCount: number,
    quorumCount: number,
    averageConfidence: number,
    maxLatencyMs: number,
    reason: string,
  ): OcrReliabilityAssessment {
    return {
      verdict,
      acceptedValue,
      frameCount,
      quorumCount,
      averageConfidence,
      maxLatencyMs,
      reason,
    };
  }
}
