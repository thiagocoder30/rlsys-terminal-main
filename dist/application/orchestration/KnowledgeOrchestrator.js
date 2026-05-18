"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KnowledgeOrchestrator = void 0;
const KnowledgeCompiler_1 = require("../../domain/knowledge/KnowledgeCompiler");
class KnowledgeOrchestrator {
    constructor(aggregator, analyzerConfig, compilerConfig, repository) {
        this.aggregator = aggregator;
        this.analyzerConfig = analyzerConfig;
        this.compilerConfig = compilerConfig;
        this.repository = repository;
    }
    /**
     * Executa o pipeline completo: Extrai -> Analisa -> Compila -> Salva.
     * Complexidade: O(D * N), onde D é a quantidade de dealers alvos e N o buffer maximo.
     */
    runPipeline(targetDealerIds, currentTimeMs) {
        let snapshotsGenerated = 0;
        const failures = [];
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
                const compilerResult = KnowledgeCompiler_1.KnowledgeCompiler.compile(snapshotId, rawEdges, this.compilerConfig, currentTimeMs);
                if (!compilerResult.success) {
                    failures.push({ dealerId, reason: compilerResult.error || 'COMPILATION_FAILED' });
                    continue;
                }
                // 3. Persistência (DIP)
                this.repository.save(compilerResult.snapshot);
                snapshotsGenerated++;
            }
            catch (error) {
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
exports.KnowledgeOrchestrator = KnowledgeOrchestrator;
