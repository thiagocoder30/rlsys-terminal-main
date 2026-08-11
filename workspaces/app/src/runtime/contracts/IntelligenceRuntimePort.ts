import { QuantitativeInput } from '../../domain/intelligence/common/QuantitativeInput';
import { IntelligenceExecutionResult } from '../result/IntelligenceExecutionResult';

export interface IntelligenceRuntimePort {
    execute(input: QuantitativeInput): IntelligenceExecutionResult;
}
