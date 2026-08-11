import { describe, it, expect, vi } from 'vitest';
import { QuantitativeEnginePipeline } from '../../../src/application/intelligence/QuantitativeEnginePipeline';
import { QuantitativeEngineRegistry } from '../../../src/application/intelligence/QuantitativeEngineRegistry';
import { IQuantitativeEngine } from '../../../src/domain/contracts/IQuantitativeEngine';
import { QuantitativeInput } from '../../../src/domain/intelligence/common/QuantitativeInput';
import { QuantitativeOutput } from '../../../src/domain/intelligence/common/QuantitativeOutput';

describe('QuantitativeEnginePipeline', () => {
  it('should execute registered engines in order and aggregate outputs', () => {
    const registry = new QuantitativeEngineRegistry();
    
    const mockOutput1: QuantitativeOutput = {
      engineName: 'Engine1',
      score: 10,
      confidence: 0.9,
      executionTime: 5,
      metadata: { durationMs: 5, version: '1.0', algorithmName: 'algo1', status: 'SUCCESS', messages: [] },
      diagnostics: {}
    };

    const mockOutput2: QuantitativeOutput = {
      engineName: 'Engine2',
      score: 20,
      confidence: 0.8,
      executionTime: 8,
      metadata: { durationMs: 8, version: '1.0', algorithmName: 'algo2', status: 'SUCCESS', messages: [] },
      diagnostics: {}
    };

    const engine1: IQuantitativeEngine = {
      engineName: 'Engine1',
      execute: vi.fn().mockReturnValue(mockOutput1)
    };

    const engine2: IQuantitativeEngine = {
      engineName: 'Engine2',
      execute: vi.fn().mockReturnValue(mockOutput2)
    };

    registry.register(engine1);
    registry.register(engine2);

    const pipeline = new QuantitativeEnginePipeline(registry);

    const input: QuantitativeInput = {
      sessionId: 'sess1',
      timestamp: new Date().toISOString(),
      recentSpins: [0, 32, 15],
      analyzedWindow: 3,
      executionParameters: {}
    };

    const results = pipeline.executeAll(input);

    expect(results.length).toBe(2);
    expect(results[0]).toBe(mockOutput1);
    expect(results[1]).toBe(mockOutput2);
    expect(engine1.execute).toHaveBeenCalledWith(input);
    expect(engine2.execute).toHaveBeenCalledWith(input);
  });

  it('should gracefully handle engine execution failures', () => {
    const registry = new QuantitativeEngineRegistry();
    
    const failingEngine: IQuantitativeEngine = {
      engineName: 'FailingEngine',
      execute: vi.fn().mockImplementation(() => {
        throw new Error('Engine crashed');
      })
    };

    registry.register(failingEngine);

    const pipeline = new QuantitativeEnginePipeline(registry);
    
    const input: QuantitativeInput = {
      sessionId: 'sess1',
      timestamp: new Date().toISOString(),
      recentSpins: [],
      analyzedWindow: 0,
      executionParameters: {}
    };

    const results = pipeline.executeAll(input);
    
    expect(results.length).toBe(1);
    expect(results[0].engineName).toBe('FailingEngine');
    expect(results[0].metadata.status).toBe('FAILED');
    expect(results[0].metadata.messages).toContain('Engine crashed');
    expect(results[0].score).toBe(0);
  });
});
