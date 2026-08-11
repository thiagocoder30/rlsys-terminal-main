import { describe, it, expect, vi } from 'vitest';
import { TacticalRuntimeAdapter } from '../../src/adapters/pwa/TacticalRuntimeAdapter';
import { CLIIntelligenceAdapter } from '../../src/adapters/cli/CLIIntelligenceAdapter';
import { RuntimeController } from '../../src/adapters/api/RuntimeController';
import { IntelligenceRuntimePort } from '../../src/runtime/contracts/IntelligenceRuntimePort';
import { QuantitativeInput } from '../../src/domain/intelligence/common/QuantitativeInput';
import { IntelligenceExecutionResult } from '../../src/runtime/result/IntelligenceExecutionResult';
import { TacticalExecutionRequest } from '../../src/runtime/contracts/TacticalExecutionRequest';

describe('Runtime Adapters', () => {
    const mockResult: IntelligenceExecutionResult = {
        summary: {} as any,
        explanation: {} as any,
        executionMetadata: {},
        processingTime: 10,
        runtimeStatus: 'SUCCESS',
        diagnostics: {}
    };

    const mockRuntime: IntelligenceRuntimePort = {
        execute: vi.fn().mockReturnValue(mockResult)
    };

    const quantitativeInput: QuantitativeInput = {
        sessionId: 'test-session',
        timestamp: expect.any(String),
        recentSpins: [1, 2, 3],
        analyzedWindow: 3,
        executionParameters: {
            provider: 'test-provider',
            bankroll: 1000
        }
    };

    const tacticalRequest: TacticalExecutionRequest = {
        sessionId: 'test-session',
        bankroll: 1000,
        provider: 'test-provider',
        recentSpins: [1, 2, 3],
        tacticalMetadata: {}
    };

    const cliAndApiInput: QuantitativeInput = {
        sessionId: 'test-session',
        timestamp: new Date().toISOString(),
        recentSpins: [1, 2, 3],
        analyzedWindow: 3,
        executionParameters: {}
    };

    it('TacticalRuntimeAdapter should execute through IntelligenceRuntimePort mapping input', async () => {
        const adapter = new TacticalRuntimeAdapter(mockRuntime);
        const result = await adapter.execute(tacticalRequest);
        expect(mockRuntime.execute).toHaveBeenCalledWith(quantitativeInput);
        expect(result).toBe(mockResult);
    });

    it('CLIIntelligenceAdapter should execute through IntelligenceRuntimePort', async () => {
        const adapter = new CLIIntelligenceAdapter(mockRuntime);
        const result = await adapter.execute(cliAndApiInput);
        expect(mockRuntime.execute).toHaveBeenCalledWith(cliAndApiInput);
        expect(result).toBe(mockResult);
    });

    it('RuntimeController should execute through IntelligenceRuntimePort and validate input', async () => {
        const adapter = new RuntimeController(mockRuntime);
        const result = await adapter.execute(cliAndApiInput);
        expect(mockRuntime.execute).toHaveBeenCalledWith(cliAndApiInput);
        expect(result).toBe(mockResult);
        
        const invalidInput = { ...cliAndApiInput, sessionId: '' };
        await expect(adapter.execute(invalidInput)).rejects.toThrow('Invalid input');
    });
});
