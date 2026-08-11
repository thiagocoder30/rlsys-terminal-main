import { IStrategy, StrategyName, StrategyResult } from "./StrategyTypes";

export class StrategyRegistry {
  private static strategies: Map<StrategyName, IStrategy> = new Map();

  static register(strategy: IStrategy): void {
    this.strategies.set(strategy.name, strategy);
  }

  static get(name: StrategyName): IStrategy | undefined {
    return this.strategies.get(name);
  }

  static list(): StrategyName[] {
    return Array.from(this.strategies.keys());
  }

  static execute(name: StrategyName, input: unknown): StrategyResult {
    const strategy = this.strategies.get(name);
    if (!strategy) {
      throw new Error(`[StrategyRegistry] Strategy not found: ${name}`);
    }
    return strategy.analyze(input);
  }

  static explain(name: StrategyName, input: unknown): string {
    const strategy = this.strategies.get(name);
    if (!strategy) {
      throw new Error(`[StrategyRegistry] Strategy not found: ${name}`);
    }
    return strategy.explain(input);
  }
}

// AUTO-GENERATED BINDINGS (SPRINT 401-B)
import { Triplicacao } from './impl/Triplicacao';
import { FusionReduzida } from './impl/FusionReduzida';

StrategyRegistry.register(new Triplicacao());
StrategyRegistry.register(new FusionReduzida());
