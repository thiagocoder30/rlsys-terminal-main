import { MultiDealerAggregator } from '../../domain/research/MultiDealerAggregator';
import { AnalyzerConfig } from '../../domain/research/DealerBiasAnalyzer';
import { CompilerConfig } from '../../domain/knowledge/CompilerContracts';
import { KnowledgeCompiler } from '../../domain/knowledge/KnowledgeCompiler';
import { SnapshotRepository, OrchestrationResult } from './OrchestrationContracts';

export class KnowledgeOrchestrator {
  constructor(
    private readonly aggregator: MultiDealerAggregator,
    private readonly analyzerConfig: AnalyzerConfig,
    private readonly compilerConfig: CompilerConfig,
    private readonly repository: SnapshotRepository
  ) {}

  /**
   * Executa o pipeline completo: Extrai -> Analisa -> Compila -> Salva.
   * Complexidade: O(D * N), onde D é a quantidade de dealers alvos e N o buffer maximo.
   */
  public runPipeline(targetDealerIds: string[], currentTimeMs: number): OrchestrationResult {
    let snapshotsGenerated = 0;
    const failures: Array<{ dealerId: string; reason: string }> = [];

    for (const dealerId of targetDealerIds) {
      try {
        // 1. Extração e Análise (Sprint 045 e 046)
        const rawEdges = this.aggregator.analyzeDealer(dealerId, this.analyzerConfig);

        if (rawEdges.length === 0) {
          failures.push({ dealerId, reason: 'NO_SIGNIFICANT_DATA_OR_NO_ALPHA' });
          continue;
        }

        // 2. Compilação (Sprint 039)
        const snapshotId = `SNAP_${dealerId}_${currentTimeMs}`;
        const compilerResult = KnowledgeCompiler.compile(snapshotId, rawEdges, this.compilerConfig, currentTimeMs);

        if (!compilerResult.success) {
          failures.push({ dealerId, reason: compilerResult.error || 'COMPILATION_FAILED' });
          continue;
        }

        // 3. Persistência (DIP)
        this.repository.save(compilerResult.snapshot);
        snapshotsGenerated++;

      } catch (error) {
        failures.push({ dealerId, reason: 'UNEXPECTED_RUNTIME_ERROR' });
      }
    }

    return {
      dealersProcessed: targetDealerIds.length,
      snapshotsGenerated,
      failures
    };
  }
}
