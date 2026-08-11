import { useState } from 'react';
import { TacticalEnginePort } from '../../../src/runtime/contracts/TacticalEnginePort';
import { TacticalExecutionRequest } from '../../../src/runtime/contracts/TacticalExecutionRequest';
import { IntelligenceExecutionResult } from '../../../src/runtime/result/IntelligenceExecutionResult';

export interface UseTacticalEngineProps {
    adapter: TacticalEnginePort;
    sessionId: string;
    provider: string;
    bankroll: number;
}

export function useTacticalEngine({ adapter, sessionId, provider, bankroll }: UseTacticalEngineProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<IntelligenceExecutionResult | null>(null);
    const [error, setError] = useState<Error | null>(null);

    const analyzeSpins = async (recentSpins: number[], tacticalMetadata?: Record<string, unknown>) => {
        setIsLoading(true);
        setError(null);
        try {
            const request: TacticalExecutionRequest = {
                sessionId,
                bankroll,
                provider,
                recentSpins,
                tacticalMetadata
            };

            const executionResult = await adapter.execute(request);
            setResult(executionResult);
            return executionResult;
        } catch (err) {
            const e = err instanceof Error ? err : new Error('Unknown error');
            setError(e);
            throw e;
        } finally {
            setIsLoading(false);
        }
    };

    return {
        analyzeSpins,
        isLoading,
        result,
        error
    };
}
