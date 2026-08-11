import { RuntimeAdapter } from '../../runtime/contracts/RuntimeAdapter';
import { TacticalEnginePort } from '../../runtime/contracts/TacticalEnginePort';
import { IntelligenceRuntimePort } from '../../runtime/contracts/IntelligenceRuntimePort';
import { TacticalExecutionRequest } from '../../runtime/contracts/TacticalExecutionRequest';
import { QuantitativeInput } from '../../domain/intelligence/common/QuantitativeInput';
import { IntelligenceExecutionResult } from '../../runtime/result/IntelligenceExecutionResult';

export class TacticalRuntimeAdapter implements RuntimeAdapter<TacticalExecutionRequest, IntelligenceExecutionResult>, TacticalEnginePort {
    constructor(private readonly runtime: IntelligenceRuntimePort) {}

    public async execute(request: TacticalExecutionRequest): Promise<IntelligenceExecutionResult> {
        const input: QuantitativeInput = {
            sessionId: request.sessionId,
            timestamp: new Date().toISOString(),
            recentSpins: request.recentSpins,
            analyzedWindow: request.recentSpins.length,
            executionParameters: {
                provider: request.provider,
                bankroll: request.bankroll,
                ...(request.tacticalMetadata || {})
            }
        };

        return this.runtime.execute(input);
    }
}
