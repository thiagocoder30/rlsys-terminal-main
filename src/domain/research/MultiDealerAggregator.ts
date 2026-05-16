import { SpinRecord, DealerBiasAnalyzer, AnalyzerConfig } from './DealerBiasAnalyzer';
import { BoundedSpinBuffer } from './BoundedSpinBuffer';
import { RawResearchSector } from '../knowledge/CompilerContracts';

export interface AggregatorConfig {
  readonly maxActiveDealers: number; // Limite rígido para RAM (Ex: 10)
  readonly maxSpinsPerDealer: number; // Limite do Ring Buffer (Ex: 1000)
}

export type AddSpinResult = 
  | { success: true }
  | { success: false; error: string };

export class MultiDealerAggregator {
  // Hash Map O(1) de acesso
  private readonly dealerProfiles = new Map<string, BoundedSpinBuffer>();

  constructor(private readonly config: AggregatorConfig) {}

  /**
   * Roteamento O(1) de rodadas para o perfil correto.
   */
  public ingestSpin(spin: SpinRecord): AddSpinResult {
    let buffer = this.dealerProfiles.get(spin.dealerId);

    if (!buffer) {
      if (this.dealerProfiles.size >= this.config.maxActiveDealers) {
        return { success: false, error: 'MAX_ACTIVE_DEALERS_REACHED' };
      }
      buffer = new BoundedSpinBuffer(this.config.maxSpinsPerDealer);
      this.dealerProfiles.set(spin.dealerId, buffer);
    }

    buffer.push(spin);
    return { success: true };
  }

  /**
   * Executa a análise pesada apenas sob demanda para um dealer específico.
   */
  public analyzeDealer(dealerId: string, analyzerConfig: AnalyzerConfig): RawResearchSector[] {
    const buffer = this.dealerProfiles.get(dealerId);
    if (!buffer || buffer.length < analyzerConfig.minSpinsRequired) {
      return []; // Falta de dados ou dealer inexistente
    }

    const spins = buffer.toArray();
    return DealerBiasAnalyzer.analyze(spins, analyzerConfig);
  }

  public getDealerCount(): number {
    return this.dealerProfiles.size;
  }

  public getSpinCount(dealerId: string): number {
    return this.dealerProfiles.get(dealerId)?.length || 0;
  }
}
