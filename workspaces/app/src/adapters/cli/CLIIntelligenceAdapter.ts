import { RuntimeAdapter } from '../../runtime/contracts/RuntimeAdapter';
import { IntelligenceRuntimePort } from '../../runtime/contracts/IntelligenceRuntimePort';
import { QuantitativeInput } from '../../domain/intelligence/common/QuantitativeInput';
import { IntelligenceExecutionResult } from '../../runtime/result/IntelligenceExecutionResult';

export class CLIIntelligenceAdapter implements RuntimeAdapter<QuantitativeInput, IntelligenceExecutionResult> {
    constructor(private readonly runtime: IntelligenceRuntimePort) {}

    public async execute(input: QuantitativeInput): Promise<IntelligenceExecutionResult> {
        return this.runtime.execute(input);
    }
}
