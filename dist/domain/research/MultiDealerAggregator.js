"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MultiDealerAggregator = void 0;
const DealerBiasAnalyzer_1 = require("./DealerBiasAnalyzer");
const BoundedSpinBuffer_1 = require("./BoundedSpinBuffer");
class MultiDealerAggregator {
    constructor(config) {
        this.config = config;
        // Hash Map O(1) de acesso
        this.dealerProfiles = new Map();
    }
    /**
     * Roteamento O(1) de rodadas para o perfil correto.
     */
    ingestSpin(spin) {
        let buffer = this.dealerProfiles.get(spin.dealerId);
        if (!buffer) {
            if (this.dealerProfiles.size >= this.config.maxActiveDealers) {
                return { success: false, error: 'MAX_ACTIVE_DEALERS_REACHED' };
            }
            buffer = new BoundedSpinBuffer_1.BoundedSpinBuffer(this.config.maxSpinsPerDealer);
            this.dealerProfiles.set(spin.dealerId, buffer);
        }
        buffer.push(spin);
        return { success: true };
    }
    /**
     * Executa a análise pesada apenas sob demanda para um dealer específico.
     */
    analyzeDealer(dealerId, analyzerConfig) {
        const buffer = this.dealerProfiles.get(dealerId);
        if (!buffer || buffer.length < analyzerConfig.minSpinsRequired) {
            return []; // Falta de dados ou dealer inexistente
        }
        const spins = buffer.toArray();
        return DealerBiasAnalyzer_1.DealerBiasAnalyzer.analyze(spins, analyzerConfig);
    }
    getDealerCount() {
        return this.dealerProfiles.size;
    }
    getSpinCount(dealerId) {
        return this.dealerProfiles.get(dealerId)?.length || 0;
    }
}
exports.MultiDealerAggregator = MultiDealerAggregator;
