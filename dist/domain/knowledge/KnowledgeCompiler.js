"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KnowledgeCompiler = void 0;
class KnowledgeCompiler {
    /**
     * Compila dados brutos num Snapshot O(1) otimizado.
     * Complexidade: O(N) no processamento, resultando num O(1) de leitura.
     */
    static compile(snapshotId, rawSectors, config, currentTimeMs) {
        if (!rawSectors || rawSectors.length === 0) {
            return { success: false, error: 'EMPTY_RESEARCH_DATA' };
        }
        const lookupTable = {};
        let validSignalsCount = 0;
        // Assume o regime do primeiro item como base do snapshot (um snapshot por regime)
        const baseRegime = {
            expectedDealerId: rawSectors[0].dealerId,
            wheelSpeedCategory: rawSectors[0].wheelSpeed
        };
        // 1. Filtragem e Construção do Hash Map (O(N))
        for (const raw of rawSectors) {
            // Rejeita sinais que não pertencem ao mesmo regime (Garante coesão do pacote)
            if (raw.dealerId !== baseRegime.expectedDealerId || raw.wheelSpeed !== baseRegime.wheelSpeedCategory) {
                continue;
            }
            // Rejeita ruído estatístico e sinais perigosos (Noise Reduction)
            if (raw.calculatedEV < config.minExpectedValue || raw.confidence < config.minConfidence) {
                continue;
            }
            // Cria a chave determinística (Ex: "D_ALICE_NORMAL")
            const stateKey = `${raw.dealerId}_${raw.wheelSpeed}`;
            if (!lookupTable[stateKey]) {
                lookupTable[stateKey] = [];
            }
            const edge = {
                targetSector: raw.targetSector,
                clusterSize: raw.clusterSize,
                expectedEV: raw.calculatedEV,
                confidenceScore: raw.confidence
            };
            lookupTable[stateKey].push(edge);
            validSignalsCount++;
        }
        // 2. Proteção contra Compilação Vazia (Falso Positivo)
        if (validSignalsCount === 0) {
            return { success: false, error: 'NO_VALID_ALPHA_FOUND_AFTER_FILTERING' };
        }
        // 3. Empacotamento
        const metadata = {
            snapshotId,
            compiledAtMs: currentTimeMs,
            validUntilMs: currentTimeMs + config.snapshotLifespanMs,
            compilerVersion: config.compilerVersion
        };
        const finalSnapshot = {
            metadata,
            constraints: baseRegime,
            lookupTable
        };
        return { success: true, snapshot: finalSnapshot };
    }
}
exports.KnowledgeCompiler = KnowledgeCompiler;
