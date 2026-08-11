import { RuntimeAdapter } from '../../runtime/contracts/RuntimeAdapter';
import { IntelligenceRuntimePort } from '../../runtime/contracts/IntelligenceRuntimePort';
import { QuantitativeInput } from '../../domain/intelligence/common/QuantitativeInput';
import { IntelligenceExecutionResult } from '../../runtime/result/IntelligenceExecutionResult';

export class RuntimeController implements RuntimeAdapter<QuantitativeInput, IntelligenceExecutionResult> {
    constructor(private readonly runtime: IntelligenceRuntimePort) {}

    public async execute(input: QuantitativeInput): Promise<IntelligenceExecutionResult> {
        if (!input.sessionId || !Array.isArray(input.recentSpins)) {
            throw new Error('Invalid input');
        }
        return this.runtime.execute(input);
    }
}
