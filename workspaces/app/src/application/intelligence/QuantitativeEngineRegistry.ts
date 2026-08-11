import { IQuantitativeEngine } from '../../domain/contracts/IQuantitativeEngine';

export class QuantitativeEngineRegistry {
  private engines: Map<string, IQuantitativeEngine> = new Map();

  public register(engine: IQuantitativeEngine): void {
    if (this.engines.has(engine.engineName)) {
      throw new Error(`Engine ${engine.engineName} is already registered.`);
    }
    this.engines.set(engine.engineName, engine);
  }

  public unregister(engineName: string): void {
    this.engines.delete(engineName);
  }

  public getEngine(engineName: string): IQuantitativeEngine | undefined {
    return this.engines.get(engineName);
  }

  public getAllEngines(): IQuantitativeEngine[] {
    return Array.from(this.engines.values());
  }
}
