import { IStrategy, StrategyResult } from '../StrategyRegistry';

export class FusionReduzida implements IStrategy {
  name = 'FUSIONREDUZIDA' as any;

  analyze(input: unknown): StrategyResult {
    // TODO: integrar lógica real existente do repositório
    return {
      score: 0,
      confidence: 0,
      metadata: {
        source: 'FusionReduzida',
        status: 'MIGRATED'
      }
    };
  }

  explain(input: unknown): string {
    return '[FusionReduzida] migrated strategy bound to registry';
  }

  confidence(input: unknown): number {
    return 0;
  }
}
