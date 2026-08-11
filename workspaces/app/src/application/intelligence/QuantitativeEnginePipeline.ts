import { QuantitativeEngineRegistry } from './QuantitativeEngineRegistry';
import { QuantitativeInput } from '../../domain/intelligence/common/QuantitativeInput';
import { QuantitativeOutput } from '../../domain/intelligence/common/QuantitativeOutput';

export class QuantitativeEnginePipeline {
  constructor(private readonly registry: QuantitativeEngineRegistry) {}

  public executeAll(input: QuantitativeInput): QuantitativeOutput[] {
    const engines = this.registry.getAllEngines();
    const results: QuantitativeOutput[] = [];

    for (const engine of engines) {
      const startTime = Date.now();
      try {
        const result = engine.execute(input);
        results.push(result);
      } catch (error) {
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        results.push({
          engineName: engine.engineName,
          score: 0,
          confidence: 0,
          executionTime: duration,
          metadata: {
            durationMs: duration,
            version: 'unknown',
            algorithmName: engine.engineName,
            status: 'FAILED',
            messages: [error instanceof Error ? error.message : 'Unknown pipeline error']
          },
          diagnostics: {}
        });
      }
    }

    return results;
  }
}
