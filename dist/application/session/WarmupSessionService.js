"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WarmupSessionService = void 0;
const DataIntegrityValidator_1 = require("../../domain/research/DataIntegrityValidator");
const DatasetEngine_1 = require("../../domain/research/DatasetEngine");
const WarmupSessionAnalyzer_1 = require("../../domain/session/WarmupSessionAnalyzer");
const VisionWarmupNormalizer_1 = require("../../domain/vision/VisionWarmupNormalizer");
/**
 * Application boundary for the 100-round warm-up flow.
 * It adapts manual datasets and OCR outputs into the same canonical domain analyzer.
 */
class WarmupSessionService {
    constructor() {
        this.datasetEngine = new DatasetEngine_1.DatasetEngine();
        this.integrityValidator = new DataIntegrityValidator_1.DataIntegrityValidator({ minRecords: 100, maxDuplicateRatio: 0.55, maxRepeatRun: 14 });
        this.visionNormalizer = new VisionWarmupNormalizer_1.VisionWarmupNormalizer();
        this.analyzer = new WarmupSessionAnalyzer_1.WarmupSessionAnalyzer({ warmupSize: 100 });
    }
    evaluate(input) {
        const normalizedInput = this.normalizeInput(input);
        const source = normalizedInput.source ?? 'dataset';
        const extraction = source === 'vision' ? this.extractVision(normalizedInput.visionRaw ?? normalizedInput.dataset) : undefined;
        if (source === 'vision' && !extraction)
            return this.rejected(source, 'OCR/visão não retornou números válidos.', 0, 0);
        const rawDataset = extraction?.values ?? normalizedInput.values ?? normalizedInput.dataset ?? [];
        const parsed = this.datasetEngine.parse(Array.isArray(rawDataset) ? [...rawDataset] : String(rawDataset ?? ''));
        const normalized = this.datasetEngine.normalize(parsed.records);
        const integrity = this.integrityValidator.validate(normalized.records);
        if (!integrity.valid || normalized.records.length < 80) {
            return {
                service: 'WarmupSessionService',
                schemaVersion: '2.7.0',
                status: 'REJECTED',
                source,
                extraction,
                dataset: {
                    totalRecords: normalized.records.length,
                    rejectedRows: parsed.rejectedRows.length,
                    checksum: normalized.checksum,
                    integrityScore: integrity.score
                },
                executiveSummary: {
                    tableGate: 'NO_GO',
                    operationalGate: 'BLOCKED',
                    headline: 'Warm-up rejeitado por integridade insuficiente ou menos de 80 números válidos.',
                    recommendations: [
                        'Enviar imagem/dataset com as últimas 100 rodadas legíveis.',
                        ...integrity.issues.slice(0, 5).map(issue => `${issue.code}: ${issue.message}`)
                    ]
                },
                generatedAt: new Date().toISOString()
            };
        }
        const values = normalized.records.map(record => record.value);
        const warmup = this.analyzer.analyze(values);
        const status = warmup.tableGate === 'NO_GO' ? 'REJECTED' : warmup.tableGate === 'OBSERVE' ? 'REVIEW' : 'ACCEPTED';
        return {
            service: 'WarmupSessionService',
            schemaVersion: '2.7.0',
            status,
            source,
            extraction,
            dataset: {
                totalRecords: normalized.records.length,
                rejectedRows: parsed.rejectedRows.length,
                checksum: normalized.checksum,
                integrityScore: integrity.score
            },
            warmup,
            executiveSummary: {
                tableGate: warmup.tableGate,
                operationalGate: 'BLOCKED',
                headline: this.headline(warmup),
                recommendations: warmup.recommendations
            },
            generatedAt: new Date().toISOString()
        };
    }
    normalizeInput(input) {
        if (input && typeof input === 'object' && !Array.isArray(input))
            return input;
        if (Array.isArray(input))
            return { source: 'manual', values: input.filter((item) => typeof item === 'number') };
        return { source: 'dataset', dataset: input };
    }
    extractVision(raw) {
        const result = this.visionNormalizer.normalize(raw);
        return result.success ? result.value : undefined;
    }
    rejected(source, headline, totalRecords, rejectedRows) {
        return {
            service: 'WarmupSessionService',
            schemaVersion: '2.7.0',
            status: 'REJECTED',
            source,
            dataset: { totalRecords, rejectedRows, integrityScore: 0 },
            executiveSummary: {
                tableGate: 'NO_GO',
                operationalGate: 'BLOCKED',
                headline,
                recommendations: ['Reenviar imagem com maior nitidez ou inserir manualmente as últimas 100 rodadas.']
            },
            generatedAt: new Date().toISOString()
        };
    }
    headline(warmup) {
        if (warmup.tableGate === 'GO_RESEARCH')
            return 'Warm-up aceito para pesquisa: mesa legível e sem bloqueadores críticos.';
        if (warmup.tableGate === 'OBSERVE')
            return 'Warm-up em observação: há sinais moderados, mas gate operacional permanece bloqueado.';
        return 'Warm-up NO GO: mesa incompleta, hostil ou com risco estatístico elevado.';
    }
}
exports.WarmupSessionService = WarmupSessionService;
