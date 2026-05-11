import { DomainError, err, ok, type Result } from '../shared/Result';

export type AdaptiveConfidenceDecision = 'ALLOW' | 'OBSERVE' | 'BLOCK_LOW_CONFIDENCE';
export type AdaptiveConfidenceGrade = 'A' | 'B' | 'C' | 'D' | 'F';

export interface AdaptiveConfidenceInput {
  readonly baseConfidence: number;
  readonly evidenceScore: number;
  readonly regimeConfidence: number;
  readonly ensembleConsensusScore: number;
  readonly temporalFreshnessWeight: number;
  readonly dataQualityScore: number;
  readonly riskPenalty: number;
  readonly noisePenalty: number;
  readonly sampleSize: number;
}

export interface AdaptiveConfidenceOptions {
  readonly minSampleSize: number;
  readonly baseThreshold: number;
  readonly maxAdaptiveThreshold: number;
  readonly observeBand: number;
  readonly noiseSensitivity: number;
  readonly riskSensitivity: number;
}

export interface AdaptiveConfidenceComponent {
  readonly name: 'BASE_SIGNAL' | 'EVIDENCE' | 'REGIME' | 'ENSEMBLE' | 'TEMPORAL' | 'DATA_QUALITY' | 'SAMPLE_ADEQUACY';
  readonly value: number;
  readonly weight: number;
  readonly contribution: number;
}

export interface AdaptiveConfidenceReport {
  readonly engineVersion: 'adaptive-confidence-v1';
  readonly decision: AdaptiveConfidenceDecision;
  readonly normalizedConfidence: number;
  readonly adaptiveThreshold: number;
  readonly margin: number;
  readonly grade: AdaptiveConfidenceGrade;
  readonly sampleAdequacy: number;
  readonly effectiveNoisePenalty: number;
  readonly effectiveRiskPenalty: number;
  readonly components: readonly AdaptiveConfidenceComponent[];
  readonly blockers: readonly string[];
  readonly warnings: readonly string[];
  readonly rationale: string;
}

const DEFAULT_OPTIONS: AdaptiveConfidenceOptions = {
  minSampleSize: 120,
  baseThreshold: 0.62,
  maxAdaptiveThreshold: 0.86,
  observeBand: 0.08,
  noiseSensitivity: 0.16,
  riskSensitivity: 0.14
};

/**
 * Calibrates final decision confidence using evidence quality and live-market noise.
 *
 * The engine is deterministic and framework-free. It is intentionally small and
 * allocation-light for low-memory Android/Termux environments. Complexity is O(1)
 * time and O(1) space because it combines a fixed number of components.
 */
export class AdaptiveConfidenceEngine {
  private readonly options: AdaptiveConfidenceOptions;

  public constructor(options: Partial<AdaptiveConfidenceOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.validateOptions(this.options);
  }

  public calibrate(input: AdaptiveConfidenceInput): Result<AdaptiveConfidenceReport, DomainError> {
    try {
      this.validateInput(input);

      const sampleAdequacy = clamp(input.sampleSize / this.options.minSampleSize);
      const effectiveNoisePenalty = clamp(input.noisePenalty * this.options.noiseSensitivity);
      const effectiveRiskPenalty = clamp(input.riskPenalty * this.options.riskSensitivity);
      const components = this.components(input, sampleAdequacy);
      const rawConfidence = components.reduce((sum, component) => sum + component.contribution, 0);
      const normalizedConfidence = clamp(rawConfidence - effectiveNoisePenalty - effectiveRiskPenalty);
      const adaptiveThreshold = this.adaptiveThreshold(input, sampleAdequacy);
      const margin = normalizedConfidence - adaptiveThreshold;
      const blockers = this.blockers(input, sampleAdequacy, normalizedConfidence, adaptiveThreshold);
      const warnings = this.warnings(input, sampleAdequacy, normalizedConfidence, adaptiveThreshold);
      const decision = this.decision(blockers, margin);
      const grade = this.grade(normalizedConfidence, margin);
      const rationale = this.rationale(decision, normalizedConfidence, adaptiveThreshold, blockers, warnings);

      return ok({
        engineVersion: 'adaptive-confidence-v1',
        decision,
        normalizedConfidence: round(normalizedConfidence),
        adaptiveThreshold: round(adaptiveThreshold),
        margin: round(margin),
        grade,
        sampleAdequacy: round(sampleAdequacy),
        effectiveNoisePenalty: round(effectiveNoisePenalty),
        effectiveRiskPenalty: round(effectiveRiskPenalty),
        components,
        blockers,
        warnings,
        rationale
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown_adaptive_confidence_error';
      return err(new DomainError(message, 'ADAPTIVE_CONFIDENCE_FAILED'));
    }
  }

  private components(input: AdaptiveConfidenceInput, sampleAdequacy: number): readonly AdaptiveConfidenceComponent[] {
    const specs: readonly Omit<AdaptiveConfidenceComponent, 'contribution'>[] = [
      { name: 'BASE_SIGNAL', value: input.baseConfidence, weight: 0.2 },
      { name: 'EVIDENCE', value: input.evidenceScore, weight: 0.2 },
      { name: 'REGIME', value: input.regimeConfidence, weight: 0.14 },
      { name: 'ENSEMBLE', value: input.ensembleConsensusScore, weight: 0.16 },
      { name: 'TEMPORAL', value: input.temporalFreshnessWeight, weight: 0.14 },
      { name: 'DATA_QUALITY', value: input.dataQualityScore, weight: 0.1 },
      { name: 'SAMPLE_ADEQUACY', value: sampleAdequacy, weight: 0.06 }
    ];

    return specs.map(spec => ({
      ...spec,
      value: round(spec.value),
      weight: round(spec.weight),
      contribution: round(spec.value * spec.weight)
    }));
  }

  private adaptiveThreshold(input: AdaptiveConfidenceInput, sampleAdequacy: number): number {
    const instabilityPremium = (1 - input.regimeConfidence) * 0.07;
    const disagreementPremium = (1 - input.ensembleConsensusScore) * 0.06;
    const agingPremium = (1 - input.temporalFreshnessWeight) * 0.05;
    const samplePremium = (1 - sampleAdequacy) * 0.08;
    const riskPremium = input.riskPenalty * 0.05;
    const noisePremium = input.noisePenalty * 0.05;
    return Math.min(
      this.options.maxAdaptiveThreshold,
      this.options.baseThreshold + instabilityPremium + disagreementPremium + agingPremium + samplePremium + riskPremium + noisePremium
    );
  }

  private blockers(
    input: AdaptiveConfidenceInput,
    sampleAdequacy: number,
    normalizedConfidence: number,
    adaptiveThreshold: number
  ): readonly string[] {
    const blockers: string[] = [];
    if (input.sampleSize < Math.ceil(this.options.minSampleSize * 0.5)) blockers.push('Amostra abaixo do piso mínimo para calibração adaptativa.');
    if (input.dataQualityScore < 0.48) blockers.push('Qualidade de dados abaixo do mínimo para confiar na decisão.');
    if (input.noisePenalty >= 0.82) blockers.push('Ruído operacional extremo bloqueia extrapolação de confiança.');
    if (sampleAdequacy < 0.45) blockers.push('Adequação amostral insuficiente para calibrar threshold.');
    if (normalizedConfidence < adaptiveThreshold - this.options.observeBand) blockers.push('Confiança normalizada abaixo da banda mínima adaptativa.');
    return blockers;
  }

  private warnings(
    input: AdaptiveConfidenceInput,
    sampleAdequacy: number,
    normalizedConfidence: number,
    adaptiveThreshold: number
  ): readonly string[] {
    const warnings: string[] = [];
    if (input.noisePenalty >= 0.55) warnings.push('Ruído operacional elevado reduz confiança final.');
    if (input.riskPenalty >= 0.5) warnings.push('Penalidade de risco elevada exige observação conservadora.');
    if (input.temporalFreshnessWeight < 0.58) warnings.push('Frescor temporal baixo reduz validade do sinal.');
    if (input.ensembleConsensusScore < 0.6) warnings.push('Consenso estratégico moderado/baixo limita assertividade.');
    if (sampleAdequacy < 0.75) warnings.push('Amostra ainda em zona de maturação estatística.');
    if (normalizedConfidence < adaptiveThreshold) warnings.push('Confiança abaixo do threshold adaptativo; manter observação.');
    return warnings;
  }

  private decision(blockers: readonly string[], margin: number): AdaptiveConfidenceDecision {
    if (blockers.length > 0) return 'BLOCK_LOW_CONFIDENCE';
    if (margin < 0) return 'OBSERVE';
    return 'ALLOW';
  }

  private grade(confidence: number, margin: number): AdaptiveConfidenceGrade {
    if (confidence >= 0.84 && margin >= 0.08) return 'A';
    if (confidence >= 0.74 && margin >= 0.03) return 'B';
    if (confidence >= 0.62 && margin >= -0.02) return 'C';
    if (confidence >= 0.5) return 'D';
    return 'F';
  }

  private rationale(
    decision: AdaptiveConfidenceDecision,
    normalizedConfidence: number,
    adaptiveThreshold: number,
    blockers: readonly string[],
    warnings: readonly string[]
  ): string {
    if (blockers.length > 0) return `Calibração ${decision}: ${blockers.slice(0, 2).join(' ')}`;
    if (warnings.length > 0) return `Calibração ${decision}: confiança ${round(normalizedConfidence)} contra threshold ${round(adaptiveThreshold)} com alertas.`;
    return `Calibração ${decision}: confiança ${round(normalizedConfidence)} supera threshold adaptativo ${round(adaptiveThreshold)}.`;
  }

  private validateInput(input: AdaptiveConfidenceInput): void {
    if (!input || typeof input !== 'object') throw new Error('invalid_adaptive_confidence_input');
    if (!isUnit(input.baseConfidence)) throw new Error('invalid_adaptive_base_confidence');
    if (!isUnit(input.evidenceScore)) throw new Error('invalid_adaptive_evidence_score');
    if (!isUnit(input.regimeConfidence)) throw new Error('invalid_adaptive_regime_confidence');
    if (!isUnit(input.ensembleConsensusScore)) throw new Error('invalid_adaptive_ensemble_consensus_score');
    if (!isUnit(input.temporalFreshnessWeight)) throw new Error('invalid_adaptive_temporal_freshness_weight');
    if (!isUnit(input.dataQualityScore)) throw new Error('invalid_adaptive_data_quality_score');
    if (!isUnit(input.riskPenalty)) throw new Error('invalid_adaptive_risk_penalty');
    if (!isUnit(input.noisePenalty)) throw new Error('invalid_adaptive_noise_penalty');
    if (!Number.isInteger(input.sampleSize) || input.sampleSize < 0) throw new Error('invalid_adaptive_sample_size');
  }

  private validateOptions(options: AdaptiveConfidenceOptions): void {
    if (!Number.isInteger(options.minSampleSize) || options.minSampleSize <= 0) throw new Error('invalid_adaptive_min_sample_size');
    if (!isUnit(options.baseThreshold)) throw new Error('invalid_adaptive_base_threshold');
    if (!isUnit(options.maxAdaptiveThreshold)) throw new Error('invalid_adaptive_max_threshold');
    if (!isUnit(options.observeBand)) throw new Error('invalid_adaptive_observe_band');
    if (!isUnit(options.noiseSensitivity)) throw new Error('invalid_adaptive_noise_sensitivity');
    if (!isUnit(options.riskSensitivity)) throw new Error('invalid_adaptive_risk_sensitivity');
    if (options.maxAdaptiveThreshold < options.baseThreshold) throw new Error('invalid_adaptive_threshold_order');
  }
}

function isUnit(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function round(value: number): number {
  return Number(value.toFixed(6));
}
