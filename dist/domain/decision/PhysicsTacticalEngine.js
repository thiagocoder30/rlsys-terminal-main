"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PhysicsTacticalEngine = void 0;
const DecisionContracts_1 = require("./DecisionContracts");
class PhysicsTacticalEngine {
    constructor(snapshot) {
        this.snapshot = snapshot;
    }
    /**
     * Avaliação de Assinatura Física O(1).
     * Correlaciona Velocidade + Dealer + Setor de Saída.
     */
    evaluate(state) {
        // Chave Composta: Ex: "D_ALICE_FAST_32"
        const compositeKey = `${state.dealerId}_${state.wheelSpeedCategory}_${state.targetSector}`;
        // Procura na tabela de assinaturas físicas (evolução da lookup table)
        const entry = this.snapshot.lookupTable[compositeKey];
        if (!entry || entry.length === 0) {
            return {
                action: DecisionContracts_1.ActionSignal.OBSERVE,
                expectedEV: 0,
                confidence: 0,
                reason: 'INSUFFICIENT_PHYSICS_DATA'
            };
        }
        // Pega o melhor cluster para aquela assinatura de lançamento
        const bestCluster = entry[0];
        return {
            action: DecisionContracts_1.ActionSignal.SIGNAL,
            expectedEV: bestCluster.expectedEV,
            confidence: bestCluster.confidenceScore,
            reason: 'SIGNATURE_MATCH'
        };
    }
}
exports.PhysicsTacticalEngine = PhysicsTacticalEngine;
