import { describe, it, expect, vi } from 'vitest';
import { TacticalRuntimeAdapter } from '../../src/adapters/pwa/TacticalRuntimeAdapter';
import { IntelligenceRuntimePort } from '../../src/runtime/contracts/IntelligenceRuntimePort';
import { TacticalExecutionRequest } from '../../src/runtime/contracts/TacticalExecutionRequest';
import { IntelligenceExecutionResult } from '../../src/runtime/result/IntelligenceExecutionResult';
import { QuantitativeInput } from '../../src/domain/intelligence/common/QuantitativeInput';

describe('TacticalRuntimeAdapter Architecture Integrity', () => {
    it('should translate request and delegate to IntelligenceRuntimePort without executing quantitative logic', async () => {
        const mockResult: IntelligenceExecutionResult = {
            summary: {} as any,
            explanation: {} as any,
            executionMetadata: { executionId: 'exec-tactical-1' },
            processingTime: 10,
            runtimeStatus: 'SUCCESS',
            diagnostics: {}
        };

        const mockRuntime: IntelligenceRuntimePort = {
            execute: vi.fn().mockReturnValue(mockResult)
        };

        const adapter = new TacticalRuntimeAdapter(mockRuntime);

        const request: TacticalExecutionRequest = {
            sessionId: 'tactical-session-1',
            bankroll: 1500,
            provider: 'TestProvider',
            recentSpins: [1, 2, 3],
            tacticalMetadata: { someFlag: true }
        };

        const result = await adapter.execute(request);

        // Verify output matches
        expect(result).toBe(mockResult);

        // Verify input translation
        expect(mockRuntime.execute).toHaveBeenCalledTimes(1);
        const calledInput = vi.mocked(mockRuntime.execute).mock.calls[0][0] as QuantitativeInput;

        expect(calledInput.sessionId).toBe('tactical-session-1');
        expect(calledInput.recentSpins).toEqual([1, 2, 3]);
        expect(calledInput.analyzedWindow).toBe(3);
        expect(calledInput.executionParameters?.provider).toBe('TestProvider');
        expect(calledInput.executionParameters?.bankroll).toBe(1500);
        expect(calledInput.executionParameters?.someFlag).toBe(true);
        expect(calledInput.timestamp).toBeDefined();
    });
});
