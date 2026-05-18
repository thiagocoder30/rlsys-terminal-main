"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DecisionOrchestrator = void 0;
const crypto_1 = __importDefault(require("crypto"));
const Result_1 = require("../shared/Result");
const StrategyDecisionEngine_1 = require("./StrategyDecisionEngine");
const StrategyRankingEngine_1 = require("../strategy/StrategyRankingEngine");
/**
 * Coordinates strategy ranking and institutional decision governance.
 *
 * The orchestrator is an application-domain boundary: it composes pure domain
 * engines without depending on HTTP, UI, storage or vendor SDKs. Ranking remains
 * independent from decision rules, and the decision engine remains the single
 * source of truth for stake governance. Complexity is O(n log n + r), where n is
 * the number of strategy candidates and r is the number of decision rules.
 */
class DecisionOrchestrator {
    constructor(rankingEngine = new StrategyRankingEngine_1.StrategyRankingEngine(), decisionEngine = new StrategyDecisionEngine_1.StrategyDecisionEngine()) {
        this.rankingEngine = rankingEngine;
        this.decisionEngine = decisionEngine;
    }
    orchestrate(input) {
        try {
            this.validateInput(input);
            const ranking = this.rankingEngine.rank(input.strategyCandidates);
            const enrichedContext = this.withRankedStrategy(input.decisionContext, ranking.topCandidate);
            const decision = this.decisionEngine.decide(enrichedContext);
            const sessionBlockers = this.sessionBlockers(input.sessionControl);
            const regimeBlockers = this.regimeBlockers(input.regimeClassification);
            const ensembleBlockers = this.ensembleBlockers(input.strategyEnsemble);
            const temporalBlockers = this.temporalBlockers(input.temporalDecay);
            const adaptiveConfidenceBlockers = this.adaptiveConfidenceBlockers(input.adaptiveConfidence);
            const runtimeBudgetBlockers = this.runtimeBudgetBlockers(input.runtimePerformanceBudget);
            const externalBlockers = [...sessionBlockers, ...regimeBlockers, ...ensembleBlockers, ...temporalBlockers, ...adaptiveConfidenceBlockers, ...runtimeBudgetBlockers];
            const operationalGate = this.resolveGate(decision.operationalGate, externalBlockers);
            const action = this.resolveAction(decision.action, externalBlockers);
            const blockers = [...decision.blockers, ...externalBlockers];
            const warnings = this.warnings(decision, ranking, input.sessionControl, input.regimeClassification, input.strategyEnsemble, input.temporalDecay, input.adaptiveConfidence, input.runtimePerformanceBudget);
            const recommendedStrategy = ranking.topCandidate ? this.recommendedStrategy(ranking.topCandidate) : null;
            const status = this.status(operationalGate, blockers.length, recommendedStrategy);
            const governance = this.governance(decision, sessionBlockers);
            const rationale = this.rationale(status, blockers, warnings, recommendedStrategy);
            return (0, Result_1.ok)({
                engineVersion: 'decision-orchestrator-v1',
                orchestratorId: this.orchestratorId(enrichedContext.sessionId, ranking, decision, externalBlockers),
                sessionId: enrichedContext.sessionId,
                status,
                action,
                operationalGate,
                recommendedStrategy,
                ranking,
                decision,
                regimeClassification: input.regimeClassification ?? null,
                strategyEnsemble: input.strategyEnsemble ?? null,
                temporalDecay: input.temporalDecay ?? null,
                adaptiveConfidence: input.adaptiveConfidence ?? null,
                runtimePerformanceBudget: input.runtimePerformanceBudget ?? null,
                governance,
                blockers,
                warnings,
                rationale
            });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'unknown_decision_orchestrator_error';
            return (0, Result_1.err)(new Result_1.DomainError(message, 'DECISION_ORCHESTRATOR_FAILED'));
        }
    }
    validateInput(input) {
        if (!input || typeof input !== 'object')
            throw new Error('invalid_decision_orchestrator_input');
        if (!input.decisionContext)
            throw new Error('missing_decision_context');
        if (!Array.isArray(input.strategyCandidates))
            throw new Error('invalid_decision_orchestrator_candidates');
    }
    withRankedStrategy(context, topCandidate) {
        if (!topCandidate || topCandidate.decision !== 'ELIGIBLE') {
            return {
                ...context,
                strategy: {
                    ...context.strategy,
                    status: context.strategy.status === 'DENIED' ? 'DENIED' : 'LOCKED',
                    signalCount: 0,
                    maxSignalConfidence: 0,
                    suggestedFraction: 0
                }
            };
        }
        const rankedStrategy = {
            ...context.strategy,
            status: 'ALLOWED',
            signalCount: Math.max(1, context.strategy.signalCount),
            maxSignalConfidence: round(Math.max(context.strategy.maxSignalConfidence, topCandidate.confidenceDecay)),
            suggestedFraction: round(Math.min(0.005, Math.max(context.strategy.suggestedFraction, topCandidate.compositeScore * 0.004))),
            riskLevel: topCandidate.riskPenalty >= 0.62 ? 'CRITICAL' : topCandidate.riskPenalty >= 0.46 ? 'HIGH' : topCandidate.riskPenalty >= 0.28 ? 'MEDIUM' : 'LOW'
        };
        return { ...context, strategy: rankedStrategy };
    }
    sessionBlockers(control) {
        if (!control)
            return [];
        if (control.nextAction === 'EVALUATE_DECISION')
            return [];
        if (control.phase === 'COOLDOWN')
            return [`Sessão live em cooldown: ${control.reason}`];
        if (control.phase === 'BLOCKED')
            return [`Sessão live bloqueada: ${control.reason}`];
        return [`Sessão live ainda não está pronta para decisão: ${control.reason}`];
    }
    regimeBlockers(regime) {
        if (!regime)
            return [];
        if (regime.signalPolicy === 'BLOCK_SIGNALS') {
            return [`Regime ${regime.regime} bloqueia sinais: ${regime.rationale}`];
        }
        return [];
    }
    ensembleBlockers(ensemble) {
        if (!ensemble)
            return [];
        if (ensemble.decision === 'CONSENSUS')
            return [];
        if (ensemble.decision === 'CONFLICT')
            return [`Ensemble bloqueia sinal por conflito estratégico: ${ensemble.blockers.slice(0, 2).join('; ')}`];
        if (ensemble.decision === 'BLOCKED')
            return [`Ensemble bloqueia sinal por veto estratégico: ${ensemble.blockers.slice(0, 2).join('; ')}`];
        return [`Ensemble sem suporte suficiente: ${ensemble.blockers.slice(0, 2).join('; ')}`];
    }
    temporalBlockers(temporal) {
        if (!temporal)
            return [];
        if (temporal.decision === 'ALLOW')
            return [];
        if (temporal.decision === 'BLOCK_EXPIRED') {
            return [`Decaimento temporal bloqueia sinal: ${temporal.blockers.slice(0, 2).join('; ')}`];
        }
        return [];
    }
    adaptiveConfidenceBlockers(confidence) {
        if (!confidence)
            return [];
        if (confidence.decision === 'ALLOW')
            return [];
        if (confidence.decision === 'BLOCK_LOW_CONFIDENCE') {
            return [`Confiança adaptativa bloqueia sinal: ${confidence.blockers.slice(0, 2).join('; ')}`];
        }
        return [];
    }
    runtimeBudgetBlockers(budget) {
        if (!budget)
            return [];
        if (budget.status === 'WITHIN_BUDGET' || budget.status === 'THROTTLE')
            return [];
        if (budget.status === 'BLOCKED') {
            return [`Orçamento de performance bloqueia avaliação live: ${budget.recommendations.slice(0, 2).join('; ')}`];
        }
        return [`Orçamento de performance degradado exige bloqueio preventivo: ${budget.violations.slice(0, 2).map(violation => violation.message).join('; ')}`];
    }
    resolveGate(current, externalBlockers) {
        if (externalBlockers.length === 0)
            return current;
        if (externalBlockers.some(message => message.includes('cooldown')))
            return 'COOLDOWN';
        if (externalBlockers.some(message => message.includes('bloqueia sinais') || message.includes('Ensemble bloqueia') || message.includes('Decaimento temporal bloqueia') || message.includes('Confiança adaptativa bloqueia') || message.includes('Confiança adaptativa bloqueia')))
            return 'NO_GO';
        return 'OBSERVE';
    }
    resolveAction(current, externalBlockers) {
        if (externalBlockers.length === 0)
            return current;
        if (externalBlockers.some(message => message.includes('bloqueia sinais') || message.includes('Ensemble bloqueia') || message.includes('Decaimento temporal bloqueia') || message.includes('Confiança adaptativa bloqueia') || message.includes('Orçamento de performance')))
            return 'BLOCKED';
        return current === 'BLOCKED' ? 'BLOCKED' : 'OBSERVE';
    }
    warnings(decision, ranking, control, regime, ensemble, temporal, adaptiveConfidence, runtimeBudget) {
        const warnings = [...decision.warnings];
        if (ranking.eligibleCount === 0)
            warnings.push('Nenhuma estratégia elegível no ranking bayesiano.');
        if (control && control.nextAction !== 'EVALUATE_DECISION')
            warnings.push('Snapshot live usado apenas para observação; janela ainda não pronta para sinal.');
        if (regime?.signalPolicy === 'OBSERVE_ONLY')
            warnings.push(`Regime ${regime.regime} limita decisão para observação: ${regime.rationale}`);
        if (ensemble?.decision === 'INSUFFICIENT_SUPPORT')
            warnings.push('Ensemble não alcançou suporte suficiente para consenso institucional.');
        if (ensemble?.warnings.length)
            warnings.push(...ensemble.warnings);
        if (temporal?.decision === 'OBSERVE')
            warnings.push('Decaimento temporal exige observação: sinal ainda ativo, mas com frescor reduzido.');
        if (temporal?.warnings.length)
            warnings.push(...temporal.warnings);
        if (adaptiveConfidence?.decision === 'OBSERVE')
            warnings.push('Confiança adaptativa exige observação: threshold dinâmico ainda não foi superado.');
        if (adaptiveConfidence?.warnings.length)
            warnings.push(...adaptiveConfidence.warnings);
        if (runtimeBudget?.status === 'THROTTLE')
            warnings.push(`Orçamento de performance solicita redução de carga: throttleFactor=${runtimeBudget.throttleFactor}.`);
        if (runtimeBudget?.recommendations.length && runtimeBudget.status !== 'WITHIN_BUDGET')
            warnings.push(...runtimeBudget.recommendations.slice(0, 2));
        return warnings;
    }
    status(gate, blockerCount, recommendedStrategy) {
        if (blockerCount > 0 || gate === 'NO_GO')
            return 'REJECTED';
        if (gate === 'SIGNAL' && recommendedStrategy)
            return 'READY_FOR_RESEARCH_SIGNAL';
        return 'OBSERVE';
    }
    recommendedStrategy(item) {
        return {
            strategyId: item.strategyId,
            label: item.label,
            rank: item.rank,
            compositeScore: item.compositeScore,
            bayesianHitRate: item.bayesianHitRate,
            evidenceScore: item.evidenceScore,
            riskPenalty: item.riskPenalty,
            confidenceDecay: item.confidenceDecay,
            reasons: item.reasons
        };
    }
    governance(decision, sessionBlockers) {
        const reason = sessionBlockers.length > 0
            ? 'Governança mantém execução real bloqueada porque sessão/regime ainda não autorizam avaliação.'
            : 'Governança mantém execução real bloqueada: etapa atual é exclusivamente RESEARCH_ONLY.';
        return {
            liveStakeAllowed: false,
            executionMode: decision.execution.mode,
            reason
        };
    }
    rationale(status, blockers, warnings, recommendedStrategy) {
        if (blockers.length > 0)
            return `Orquestração ${status}: bloqueadores ativos (${blockers.slice(0, 3).join('; ')}).`;
        if (!recommendedStrategy)
            return `Orquestração ${status}: ranking não encontrou estratégia elegível para decisão.`;
        if (warnings.length > 0)
            return `Orquestração ${status}: ${recommendedStrategy.strategyId} lidera o ranking, com alertas (${warnings.slice(0, 3).join('; ')}).`;
        return `Orquestração ${status}: ${recommendedStrategy.strategyId} recomenda hipótese somente para pesquisa, sem stake real.`;
    }
    orchestratorId(sessionId, ranking, decision, externalBlockers) {
        const payload = JSON.stringify({ sessionId, ranking, decisionId: decision.reportId, externalBlockers });
        return crypto_1.default.createHash('sha256').update(payload).digest('hex').slice(0, 24);
    }
}
exports.DecisionOrchestrator = DecisionOrchestrator;
function round(value) {
    return Number(value.toFixed(6));
}
