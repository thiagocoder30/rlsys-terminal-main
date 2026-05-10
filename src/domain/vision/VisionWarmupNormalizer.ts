import crypto from 'crypto';
import { DomainError, Result, err, ok } from '../shared/Result';
import { VisionReliabilityInspector, VisionReliabilityReport } from './VisionReliabilityInspector';

export interface VisionWarmupExtraction {
  readonly values: number[];
  readonly declaredTotal?: number;
  readonly accepted: number;
  readonly rejected: number;
  readonly confidence: number;
  readonly checksum: string;
  readonly warnings: string[];
  readonly reliability: VisionReliabilityReport;
}

/**
 * Normalizes OCR/LLM outputs into a deterministic roulette history without depending on any vendor SDK.
 * It is deliberately conservative: invalid values are rejected and surfaced as warnings instead of being guessed.
 */
export class VisionWarmupNormalizer {
  private readonly reliabilityInspector = new VisionReliabilityInspector();

  public normalize(raw: string | unknown): Result<VisionWarmupExtraction, DomainError> {
    const parsed = typeof raw === 'string' ? this.parseString(raw) : raw;
    if (!parsed || typeof parsed !== 'object') return err(new DomainError('Vision payload is not an object.', 'VISION_PAYLOAD_INVALID'));

    const record = parsed as Record<string, unknown>;
    const sequence = this.extractSequence(record);
    if (!sequence) return err(new DomainError('Vision payload does not contain a sequence array.', 'VISION_SEQUENCE_MISSING'));

    const values: number[] = [];
    const itemConfidences: number[] = [];
    let rejected = 0;
    sequence.forEach(item => {
      const value = this.toRouletteValue(item);
      const confidence = this.toItemConfidence(item);
      if (value === undefined) rejected += 1;
      else {
        values.push(value);
        if (confidence !== undefined) itemConfidences.push(confidence);
      }
    });

    if (values.length === 0) return err(new DomainError('Vision payload did not contain valid roulette numbers.', 'VISION_NO_VALID_VALUES'));

    const declaredTotal = this.toPositiveInteger(record.total ?? record.count ?? record.quantidade);
    const warnings: string[] = [];
    if (declaredTotal !== undefined && declaredTotal !== values.length) warnings.push(`DECLARED_TOTAL_MISMATCH:${declaredTotal}:${values.length}`);
    if (rejected > 0) warnings.push(`REJECTED_VALUES:${rejected}`);
    if (values.length < 100) warnings.push('LESS_THAN_100_VALUES_EXTRACTED');

    const reliability = this.reliabilityInspector.inspect({ values, rejected, declaredTotal, itemConfidences });
    reliability.issues.forEach(issue => {
      if (!warnings.includes(issue.code)) warnings.push(issue.code);
    });

    const confidence = Math.min(reliability.score, Math.max(0, Math.min(1, 1 - rejected / Math.max(1, values.length + rejected) - warnings.length * 0.08)));
    return ok({
      values,
      declaredTotal,
      accepted: values.length,
      rejected,
      confidence: Number(confidence.toFixed(6)),
      checksum: crypto.createHash('sha256').update(JSON.stringify(values)).digest('hex'),
      warnings,
      reliability
    });
  }

  private parseString(raw: string): unknown {
    const cleaned = raw.replace(/```json/g, '').replace(/```/g, '').trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    const tokens = cleaned.split(/[\s,;|]+/).filter(Boolean);
    return { sequencia: tokens };
  }

  private extractSequence(record: Record<string, unknown>): unknown[] | undefined {
    const candidate = record.sequencia ?? record.history ?? record.values ?? record.numbers ?? record.resultados;
    return Array.isArray(candidate) ? candidate : undefined;
  }

  private toRouletteValue(value: unknown): number | undefined {
    const candidate = this.extractValueCandidate(value);
    const numeric = typeof candidate === 'number' ? candidate : Number(String(candidate).trim());
    if (!Number.isInteger(numeric) || numeric < 0 || numeric > 36) return undefined;
    return numeric;
  }

  private extractValueCandidate(value: unknown): unknown {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
    const record = value as Record<string, unknown>;
    return record.value ?? record.numero ?? record.number ?? record.result ?? record.resultado;
  }

  private toItemConfidence(value: unknown): number | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
    const record = value as Record<string, unknown>;
    const candidate = record.confidence ?? record.confianca ?? record.score;
    const numeric = typeof candidate === 'number' ? candidate : Number(String(candidate).trim());
    if (!Number.isFinite(numeric) || numeric < 0 || numeric > 1) return undefined;
    return numeric;
  }

  private toPositiveInteger(value: unknown): number | undefined {
    const numeric = typeof value === 'number' ? value : Number(String(value).trim());
    if (!Number.isInteger(numeric) || numeric < 0) return undefined;
    return numeric;
  }
}
