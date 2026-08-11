import { QuantitativeInput } from '../../domain/intelligence/common/QuantitativeInput';

export interface IntelligenceExecutionContext {
  readonly executionId: string;
  readonly timestamp: string;
  readonly input: QuantitativeInput;
  readonly runtimeMetadata: Record<string, unknown>;
  readonly correlationId: string;
}
