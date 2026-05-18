"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PersistenceResearchService = void 0;
const DatasetEngine_1 = require("../../domain/research/DatasetEngine");
const DataIntegrityValidator_1 = require("../../domain/research/DataIntegrityValidator");
const EdgePersistenceAnalyzer_1 = require("../../domain/persistence/EdgePersistenceAnalyzer");
class PersistenceResearchService {
    constructor(datasetEngine = new DatasetEngine_1.DatasetEngine(), integrityValidator = new DataIntegrityValidator_1.DataIntegrityValidator(), persistenceAnalyzer = new EdgePersistenceAnalyzer_1.EdgePersistenceAnalyzer()) {
        this.datasetEngine = datasetEngine;
        this.integrityValidator = integrityValidator;
        this.persistenceAnalyzer = persistenceAnalyzer;
    }
    evaluate(input) {
        const parsed = this.datasetEngine.parse(input);
        const normalized = this.datasetEngine.normalize(parsed.records);
        const integrity = this.integrityValidator.validate(normalized.records);
        const values = normalized.records.map(record => record.value);
        const persistence = this.persistenceAnalyzer.analyze(values);
        const researchScore = this.score(integrity.score, persistence.persistenceScore, parsed.rejectedRows.length, parsed.records.length);
        const status = this.status(integrity, persistence, researchScore);
        return {
            status,
            integrity,
            persistence,
            researchScore,
            operationalGate: 'BLOCKED',
            recommendations: this.recommend(status, persistence)
        };
    }
    score(integrityScore, persistenceScore, rejectedRows, acceptedRows) {
        const rejectionPenalty = acceptedRows + rejectedRows === 0 ? 0.5 : Math.min(0.35, rejectedRows / (acceptedRows + rejectedRows));
        return round(Math.max(0, Math.min(1, integrityScore * 0.4 + persistenceScore * 0.6 - rejectionPenalty)));
    }
    status(integrity, persistence, score) {
        if (!integrity.valid)
            return 'REJECTED';
        if ((persistence.verdict === 'STRONG_PERSISTENCE' || persistence.verdict === 'MODERATE_PERSISTENCE') && score >= 0.68) {
            return 'PERSISTENCE_RESEARCH_READY';
        }
        return 'INCONCLUSIVE';
    }
    recommend(status, persistence) {
        const recommendations = [...persistence.recommendations];
        recommendations.push('Manter gate operacional bloqueado: persistência de edge é evidência de pesquisa, não autorização de aposta.');
        if (status === 'PERSISTENCE_RESEARCH_READY')
            recommendations.push('Próxima etapa obrigatória: Research Reporting Layer com trilha reproduzível e validação adversarial.');
        return [...new Set(recommendations)];
    }
}
exports.PersistenceResearchService = PersistenceResearchService;
function round(value) {
    if (!Number.isFinite(value))
        return 0;
    return Number(value.toFixed(6));
}
