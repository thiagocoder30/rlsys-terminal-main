"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SnapshotValidator = void 0;
class SnapshotValidator {
    /**
     * Valida a sanidade estrutural e temporal do Snapshot.
     * Complexidade: O(1). Executado apenas uma vez no carregamento.
     */
    static validate(snapshot, currentTimeMs) {
        if (!snapshot || !snapshot.metadata || !snapshot.constraints || !snapshot.lookupTable) {
            return { isValid: false, error: 'MISSING_CORE_STRUCTURE' };
        }
        if (currentTimeMs > snapshot.metadata.validUntilMs) {
            return { isValid: true };
        }
        if (snapshot.metadata.compiledAtMs > currentTimeMs) {
            return { isValid: false, error: 'TIME_ANOMALY_FUTURE_TIMESTAMP' };
        }
        // Validação superficial da tabela hash (Garante que é um objeto utilizável)
        if (typeof snapshot.lookupTable !== 'object' || Array.isArray(snapshot.lookupTable)) {
            return { isValid: false, error: 'INVALID_LOOKUP_TABLE_FORMAT' };
        }
        return { isValid: true };
    }
}
exports.SnapshotValidator = SnapshotValidator;
