"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DealerBiasAnalyzer = void 0;
const WheelTopology_1 = require("./WheelTopology");
class DealerBiasAnalyzer {
    /**
     * Analisa um histórico de rodadas usando flat loops O(N) para poupar memória RAM.
     */
    static analyze(spins, config) {
        const totalSpins = spins.length;
        if (totalSpins < config.minSpinsRequired) {
            return [];
        }
        const findings = [];
        const dealerId = spins[0].dealerId;
        const wheelSpeed = spins[0].wheelSpeed;
        const payoutMultiplier = 36 / config.clusterSize;
        // Itera pelos 37 centros possíveis na roda (0 a 36)
        for (let targetSector = 0; targetSector <= 36; targetSector++) {
            const cluster = WheelTopology_1.WheelTopology.getCluster(targetSector, config.clusterSize);
            let hitCount = 0;
            // Flat loop para evitar iterações com callback
            for (let i = 0; i < totalSpins; i++) {
                if (WheelTopology_1.WheelTopology.isHit(spins[i].result, cluster)) {
                    hitCount++;
                }
            }
            const observedProbability = hitCount / totalSpins;
            const expectedValue = (observedProbability * payoutMultiplier) - 1;
            if (expectedValue >= config.minEdgeEV) {
                // Fórmula de confiança heurística
                const confidence = Math.min(1.0, 0.50 + (totalSpins / 1000) * 0.40);
                findings.push({
                    dealerId,
                    wheelSpeed,
                    targetSector,
                    clusterSize: config.clusterSize,
                    calculatedEV: expectedValue,
                    confidence
                });
            }
        }
        // Ordena inplace pelo melhor EV
        return findings.sort((a, b) => b.calculatedEV - a.calculatedEV);
    }
}
exports.DealerBiasAnalyzer = DealerBiasAnalyzer;
