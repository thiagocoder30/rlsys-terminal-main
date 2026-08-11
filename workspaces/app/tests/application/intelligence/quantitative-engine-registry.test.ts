import { describe, it, expect, vi } from 'vitest';
import { QuantitativeEngineRegistry } from '../../../src/application/intelligence/QuantitativeEngineRegistry';
import { IQuantitativeEngine } from '../../../src/domain/contracts/IQuantitativeEngine';

describe('QuantitativeEngineRegistry', () => {
  it('should register and retrieve an engine', () => {
    const registry = new QuantitativeEngineRegistry();
    const mockEngine: IQuantitativeEngine = {
      engineName: 'TestEngine',
      execute: vi.fn()
    };

    registry.register(mockEngine);
    expect(registry.getEngine('TestEngine')).toBe(mockEngine);
    expect(registry.getAllEngines().length).toBe(1);
  });

  it('should not allow duplicate registrations', () => {
    const registry = new QuantitativeEngineRegistry();
    const mockEngine: IQuantitativeEngine = {
      engineName: 'TestEngine',
      execute: vi.fn()
    };

    registry.register(mockEngine);
    expect(() => registry.register(mockEngine)).toThrow(/already registered/);
  });

  it('should unregister an engine', () => {
    const registry = new QuantitativeEngineRegistry();
    const mockEngine: IQuantitativeEngine = {
      engineName: 'TestEngine',
      execute: vi.fn()
    };

    registry.register(mockEngine);
    registry.unregister('TestEngine');
    
    expect(registry.getEngine('TestEngine')).toBeUndefined();
    expect(registry.getAllEngines().length).toBe(0);
  });
});
