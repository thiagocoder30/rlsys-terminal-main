export type StrategyRiskLevel =
  | 'LOW'
  | 'MEDIUM'
  | 'HIGH';

export interface StrategyCapability {
  readonly name: string;
  readonly domain: string;
  readonly risk: StrategyRiskLevel;
  readonly signals: readonly string[];
  readonly sourceFile: string;
}

export class StrategyCapabilityMap {
  private readonly capabilities = new Map<string, StrategyCapability>();

  public register(capability: StrategyCapability): void {
    this.capabilities.set(capability.name, capability);
  }

  public get(name: string): StrategyCapability | undefined {
    return this.capabilities.get(name);
  }

  public getAll(): readonly StrategyCapability[] {
    return Array.from(this.capabilities.values());
  }
}
