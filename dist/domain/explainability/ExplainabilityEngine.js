"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExplainabilityEngine = void 0;
const crypto_1 = __importDefault(require("crypto"));
const Result_1 = require("../shared/Result");
/**
 * Builds deterministic explanations for operator-facing decisions.
 *
 * The engine is intentionally read-only: it does not rank strategies, mutate
 * sessions or authorize stake. It converts an already computed decision report
 * into bounded evidence cards and an audit narrative that can be rendered by a
 * UI, persisted in logs or attached to sprint/research reports.
 *
 * Complexity: O(b + w + m), where b is blocker count, w is warning count and m
 * is the fixed number of supported modules. Space is O(k), bounded by
 * maxEvidenceItems, which keeps the output safe for low-memory Android devices.
 */
class ExplainabilityEngine {
    explain(input) {
        try {
            this.validateInput(input);
            const report = input.decisionReport;
            const maxEvidenceItems = this.resolveMaxEvidenceItems(input.maxEvidenceItems);
            const moduleSummaries = this.moduleSummaries(report);
            const evidence = this.evidence(report, moduleSummaries, maxEvidenceItems);
            const primaryReason = this.primaryReason(report, evidence);
            const executiveSummary = this.executiveSummary(report, primaryReason);
            const auditNarrative = this.auditNarrative(report, executiveSummary, evidence, moduleSummaries);
            const checksum = this.checksumPayload(report, evidence, moduleSummaries, auditNarrative);
            return (0, Result_1.ok)({
                engineVersion: 'explainability-engine-v1',
                explanationId: checksum.slice(0, 24),
                sessionId: report.sessionId,
                decisionStatus: report.status,
                action: report.action,
                operationalGate: report.operationalGate,
                recommendedStrategy: report.recommendedStrategy,
                executiveSummary,
                primaryReason,
                evidence,
                moduleSummaries,
                blockers: [...report.blockers],
                warnings: [...report.warnings],
                auditNarrative,
                checksum
            });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'unknown_explainability_error';
            return (0, Result_1.err)(new Result_1.DomainError(message, 'EXPLAINABILITY_FAILED'));
        }
    }
    validateInput(input) {
        if (!input || typeof input !== 'object')
            throw new Error('invalid_explainability_input');
        if (!input.decisionReport || typeof input.decisionReport !== 'object')
            throw new Error('missing_decision_report');
        if (!input.decisionReport.sessionId || typeof input.decisionReport.sessionId !== 'string')
            throw new Error('invalid_explainability_session');
        if (!Array.isArray(input.decisionReport.blockers))
            throw new Error('invalid_explainability_blockers');
        if (!Array.isArray(input.decisionReport.warnings))
            throw new Error('invalid_explainability_warnings');
        if (input.maxEvidenceItems !== undefined && (!Number.isInteger(input.maxEvidenceItems) || input.maxEvidenceItems < 1 || input.maxEvidenceItems > 50)) {
            throw new Error('invalid_explainability_evidence_limit');
        }
    }
    resolveMaxEvidenceItems(maxEvidenceItems) {
        return maxEvidenceItems ?? ExplainabilityEngine.DEFAULT_MAX_EVIDENCE_ITEMS;
    }
    moduleSummaries(report) {
        const modules = ['SESSION', 'RANKING', 'DECISION', 'REGIME', 'ENSEMBLE', 'TEMPORAL', 'CONFIDENCE', 'GOVERNANCE'];
        return modules.map(module => this.moduleSummary(module, report));
    }
    moduleSummary(module, report) {
        switch (module) {
            case 'SESSION':
                return this.summaryFromSignal(module, report.status === 'READY_FOR_RESEARCH_SIGNAL', this.matches(report.blockers, ['Sessão live']), this.matches(report.warnings, ['Snapshot live']), 'Sessão live pronta para avaliação.', 'Sessão live exige observação.', 'Sessão live bloqueia a decisão.');
            case 'RANKING':
                return this.summaryFromSignal(module, Boolean(report.recommendedStrategy), this.matches(report.warnings, ['Nenhuma estratégia elegível']), false, 'Ranking encontrou estratégia líder.', 'Ranking sem estratégia elegível.', 'Ranking bloqueia por ausência de estratégia.');
            case 'DECISION':
                return this.summaryFromSignal(module, report.action === 'CONSERVATIVE_ENTRY' || report.action === 'MODERATE_ENTRY', report.decision.blockers.length > 0, report.decision.warnings.length > 0, 'Motor de decisão gerou hipótese research-only.', 'Motor de decisão mantém observação.', 'Motor de decisão possui bloqueadores.');
            case 'REGIME':
                return this.summaryFromSignal(module, report.regimeClassification?.signalPolicy === 'ALLOW_RESEARCH', this.matches(report.blockers, ['Regime']), report.regimeClassification?.signalPolicy === 'OBSERVE_ONLY', 'Regime permite sinais de pesquisa.', 'Regime limita sinais para observação.', 'Regime bloqueia sinais.');
            case 'ENSEMBLE':
                return this.summaryFromSignal(module, report.strategyEnsemble?.decision === 'CONSENSUS', this.matches(report.blockers, ['Ensemble bloqueia']), report.strategyEnsemble?.decision === 'INSUFFICIENT_SUPPORT', 'Ensemble confirma consenso.', 'Ensemble sem suporte suficiente.', 'Ensemble bloqueia por conflito/veto.');
            case 'TEMPORAL':
                return this.summaryFromSignal(module, report.temporalDecay?.decision === 'ALLOW', this.matches(report.blockers, ['Decaimento temporal']), report.temporalDecay?.decision === 'OBSERVE', 'Sinal temporal ainda fresco.', 'Sinal temporal envelhecendo.', 'Sinal temporal expirado.');
            case 'CONFIDENCE':
                return this.summaryFromSignal(module, report.adaptiveConfidence?.decision === 'ALLOW', this.matches(report.blockers, ['Confiança adaptativa']), report.adaptiveConfidence?.decision === 'OBSERVE', 'Confiança adaptativa validada.', 'Confiança adaptativa exige observação.', 'Confiança adaptativa bloqueia sinal.');
            case 'GOVERNANCE':
                return {
                    module,
                    status: 'OBSERVE',
                    contribution: 0.5,
                    message: report.governance.reason
                };
        }
    }
    summaryFromSignal(module, clear, blocking, observing, clearMessage, observeMessage, blockMessage) {
        if (blocking)
            return { module, status: 'BLOCKING', contribution: 1, message: blockMessage };
        if (observing || !clear)
            return { module, status: 'OBSERVE', contribution: 0.5, message: observeMessage };
        return { module, status: 'CLEAR', contribution: 0, message: clearMessage };
    }
    matches(messages, patterns) {
        return messages.some(message => patterns.some(pattern => message.includes(pattern)));
    }
    evidence(report, moduleSummaries, maxEvidenceItems) {
        const evidence = [];
        for (const blocker of report.blockers) {
            evidence.push({ module: this.moduleFromMessage(blocker), severity: 'BLOCKER', title: 'Bloqueador ativo', detail: blocker, weight: 1 });
            if (evidence.length >= maxEvidenceItems)
                return evidence;
        }
        for (const warning of report.warnings) {
            evidence.push({ module: this.moduleFromMessage(warning), severity: 'WARNING', title: 'Alerta operacional', detail: warning, weight: 0.5 });
            if (evidence.length >= maxEvidenceItems)
                return evidence;
        }
        if (report.recommendedStrategy) {
            evidence.push({
                module: 'RANKING',
                severity: 'INFO',
                title: 'Estratégia líder',
                detail: `${report.recommendedStrategy.strategyId} lidera com score composto ${report.recommendedStrategy.compositeScore}.`,
                weight: 0.25
            });
        }
        for (const summary of moduleSummaries) {
            if (evidence.length >= maxEvidenceItems)
                return evidence;
            evidence.push({
                module: summary.module,
                severity: summary.status === 'BLOCKING' ? 'BLOCKER' : summary.status === 'OBSERVE' ? 'WARNING' : 'INFO',
                title: `Módulo ${summary.module}`,
                detail: summary.message,
                weight: summary.contribution
            });
        }
        return evidence.slice(0, maxEvidenceItems);
    }
    moduleFromMessage(message) {
        if (message.includes('Sessão'))
            return 'SESSION';
        if (message.includes('Regime'))
            return 'REGIME';
        if (message.includes('Ensemble'))
            return 'ENSEMBLE';
        if (message.includes('Decaimento temporal'))
            return 'TEMPORAL';
        if (message.includes('Confiança adaptativa'))
            return 'CONFIDENCE';
        if (message.includes('Ranking') || message.includes('estratégia'))
            return 'RANKING';
        return 'DECISION';
    }
    primaryReason(report, evidence) {
        const firstBlocker = evidence.find(item => item.severity === 'BLOCKER');
        if (firstBlocker)
            return firstBlocker.detail;
        const firstWarning = evidence.find(item => item.severity === 'WARNING');
        if (firstWarning)
            return firstWarning.detail;
        if (report.recommendedStrategy)
            return `Estratégia ${report.recommendedStrategy.strategyId} é a hipótese research-only mais consistente.`;
        return 'Sem estratégia recomendada para a decisão atual.';
    }
    executiveSummary(report, primaryReason) {
        if (report.status === 'REJECTED')
            return `Decisão rejeitada: ${primaryReason}`;
        if (report.status === 'READY_FOR_RESEARCH_SIGNAL')
            return `Hipótese research-only pronta: ${primaryReason}`;
        return `Decisão em observação: ${primaryReason}`;
    }
    auditNarrative(report, executiveSummary, evidence, moduleSummaries) {
        const strategy = report.recommendedStrategy ? ` Estratégia líder: ${report.recommendedStrategy.strategyId}.` : ' Nenhuma estratégia líder elegível.';
        const modules = moduleSummaries.map(item => `${item.module}:${item.status}`).join(', ');
        const evidenceCount = evidence.length;
        return `${executiveSummary}${strategy} Gate=${report.operationalGate}; action=${report.action}; evidence=${evidenceCount}; modules=[${modules}]. Execução real permanece ${report.governance.executionMode}.`;
    }
    checksumPayload(report, evidence, moduleSummaries, auditNarrative) {
        const payload = JSON.stringify({
            sessionId: report.sessionId,
            orchestratorId: report.orchestratorId,
            status: report.status,
            action: report.action,
            gate: report.operationalGate,
            recommendedStrategy: report.recommendedStrategy?.strategyId ?? null,
            evidence,
            moduleSummaries,
            auditNarrative
        });
        return crypto_1.default.createHash('sha256').update(payload).digest('hex');
    }
}
exports.ExplainabilityEngine = ExplainabilityEngine;
ExplainabilityEngine.DEFAULT_MAX_EVIDENCE_ITEMS = 12;
