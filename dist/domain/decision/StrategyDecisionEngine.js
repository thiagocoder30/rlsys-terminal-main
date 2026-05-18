"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StrategyDecisionRuleFactory = exports.StrategyDecisionEngine = void 0;
const crypto_1 = __importDefault(require("crypto"));
const DEFAULT_BANKROLL_GUARD = {
    status: 'NO_STAKE',
    bankroll: 0,
    baseStake: 0,
    baseStakeFraction: 0,
    maxMartingaleLevels: 0,
    martingaleMultiplier: 2,
    martingaleStakeSequence: [],
    totalPlannedExposure: 0,
    totalExposureFraction: 0,
    stopLossAmount: 0,
    takeProfitAmount: 0,
    reasons: ['Sem entrada autorizada pelo gate.']
};
const DEFAULT_EXECUTION = {
    mode: 'RESEARCH_ONLY',
    paperStakeFraction: 0,
    liveStakeFraction: 0,
    maxSessionExposureFraction: 0,
    stopLossFraction: 0.15,
    takeProfitFraction: 0.25,
    validForSpins: 0,
    bankrollGuard: DEFAULT_BANKROLL_GUARD
};
/**
 * Converts research, risk and warm-up evidence into a deterministic operational decision.
 *
 * The engine is domain-only and side-effect free. Rules use Strategy Pattern so future
 * decision modules can be added without modifying the orchestration core. Complexity is
 * O(r), where r is the number of rules, and memory is O(r); this is safe for low-memory
 * Termux devices while keeping the decision layer auditable.
 */
class StrategyDecisionEngine {
    constructor(rules = StrategyDecisionRuleFactory.defaultRules()) {
        this.rules = rules;
    }
    decide(context) {
        this.validate(context);
        const ruleResults = this.rules.map(rule => rule.evaluate(context));
        const blockers = ruleResults.filter(result => result.severity === 'BLOCKER').map(result => result.message);
        const warnings = ruleResults.filter(result => result.severity === 'WARNING').map(result => result.message);
        const evidenceScore = round(clamp(sum(ruleResults.map(result => result.scoreContribution)) / this.rules.length));
        const riskScore = round(clamp(sum(ruleResults.map(result => result.riskContribution)) / this.rules.length));
        const confidenceScore = round(clamp(evidenceScore * 0.68 + (1 - riskScore) * 0.32));
        const action = this.action(context, blockers, warnings, confidenceScore, riskScore);
        const operationalGate = this.operationalGate(context, action, blockers, warnings, confidenceScore, riskScore);
        const execution = this.executionPlan(context, action, confidenceScore, riskScore);
        return {
            engineVersion: 'strategy-decision-v1',
            reportId: this.reportId(context, ruleResults),
            sessionId: context.sessionId,
            action,
            operationalGate,
            allowed: operationalGate === 'SIGNAL',
            confidenceScore,
            riskScore,
            evidenceScore,
            decisionGrade: this.grade(action, confidenceScore, blockers.length),
            execution,
            rules: ruleResults,
            blockers,
            warnings,
            rationale: this.rationale(action, blockers, warnings)
        };
    }
    validate(context) {
        if (!context.sessionId.trim())
            throw new Error('invalid_decision_session_id');
        if (!Number.isFinite(context.bankroll) || context.bankroll < 0)
            throw new Error('invalid_decision_bankroll');
    }
    action(context, blockers, warnings, confidenceScore, riskScore) {
        if (blockers.length > 0 || context.warmup.tableGate === 'NO_GO')
            return 'BLOCKED';
        if (context.strategy.signalCount === 0 || context.strategy.status !== 'ALLOWED')
            return 'NO_BET';
        if (confidenceScore < 0.58 || riskScore > 0.48 || warnings.length >= 3)
            return 'OBSERVE';
        if (confidenceScore >= 0.78 && riskScore <= 0.24 && context.benchmark.verdict === 'BENCHMARK_CANDIDATE')
            return 'MODERATE_ENTRY';
        return 'CONSERVATIVE_ENTRY';
    }
    operationalGate(context, action, blockers, warnings, confidenceScore, riskScore) {
        if (blockers.length > 0 || context.warmup.tableGate === 'NO_GO' || action === 'BLOCKED')
            return 'NO_GO';
        if (warnings.length >= 3 || riskScore > 0.48)
            return 'COOLDOWN';
        if (action === 'NO_BET' || action === 'OBSERVE' || confidenceScore < 0.58)
            return 'OBSERVE';
        if (action === 'CONSERVATIVE_ENTRY' || action === 'MODERATE_ENTRY')
            return 'SIGNAL';
        return 'ARMED';
    }
    executionPlan(context, action, confidenceScore, riskScore) {
        if (action === 'BLOCKED' || action === 'NO_BET' || action === 'OBSERVE') {
            return {
                ...DEFAULT_EXECUTION,
                bankrollGuard: this.bankrollGuard(context, 0, 0, 0.15, 0.25, action)
            };
        }
        const baseFraction = Math.min(0.005, Math.max(0, context.strategy.suggestedFraction));
        const confidenceMultiplier = action === 'MODERATE_ENTRY' ? 1.15 : 0.65;
        const riskThrottle = Math.max(0.15, 1 - riskScore);
        const paperStakeFraction = round(Math.min(0.006, baseFraction * confidenceMultiplier * riskThrottle * Math.max(0.5, confidenceScore)));
        const maxSessionExposureFraction = round(Math.min(0.015, Math.max(paperStakeFraction, paperStakeFraction * 7)));
        const stopLossFraction = 0.15;
        const takeProfitFraction = 0.25;
        return {
            mode: 'RESEARCH_ONLY',
            paperStakeFraction,
            liveStakeFraction: 0,
            maxSessionExposureFraction,
            stopLossFraction,
            takeProfitFraction,
            validForSpins: action === 'MODERATE_ENTRY' ? 8 : 5,
            bankrollGuard: this.bankrollGuard(context, paperStakeFraction, maxSessionExposureFraction, stopLossFraction, takeProfitFraction, action)
        };
    }
    bankrollGuard(context, paperStakeFraction, maxSessionExposureFraction, stopLossFraction, takeProfitFraction, action) {
        const bankroll = roundMoney(context.bankroll);
        const stopLossAmount = roundMoney(bankroll * stopLossFraction);
        const takeProfitAmount = roundMoney(bankroll * takeProfitFraction);
        const baseStake = roundMoney(bankroll * paperStakeFraction);
        const exposureBudget = roundMoney(Math.min(bankroll * maxSessionExposureFraction, stopLossAmount));
        if (action === 'BLOCKED' || action === 'NO_BET' || action === 'OBSERVE' || paperStakeFraction <= 0) {
            return {
                ...DEFAULT_BANKROLL_GUARD,
                bankroll,
                stopLossAmount,
                takeProfitAmount
            };
        }
        if (bankroll <= 0 || baseStake <= 0 || exposureBudget <= 0) {
            return {
                status: 'BLOCKED',
                bankroll,
                baseStake,
                baseStakeFraction: paperStakeFraction,
                maxMartingaleLevels: 0,
                martingaleMultiplier: 2,
                martingaleStakeSequence: [],
                totalPlannedExposure: 0,
                totalExposureFraction: 0,
                stopLossAmount,
                takeProfitAmount,
                reasons: ['Bankroll insuficiente ou não informado para calcular progressão segura.']
            };
        }
        const sequence = boundedMartingaleSequence(baseStake, exposureBudget, 3, 2);
        const totalPlannedExposure = roundMoney(sum(sequence));
        const totalExposureFraction = bankroll > 0 ? round(totalPlannedExposure / bankroll) : 0;
        const maxMartingaleLevels = Math.max(0, sequence.length - 1);
        const reasons = [
            `Stake base paper calculada em ${baseStake}.`,
            `Exposição máxima planejada limitada a ${totalPlannedExposure}.`,
            `Stop loss paper em ${stopLossAmount} e take profit paper em ${takeProfitAmount}.`
        ];
        return {
            status: maxMartingaleLevels > 0 ? 'MARTINGALE_READY' : 'PROTECTED',
            bankroll,
            baseStake,
            baseStakeFraction: paperStakeFraction,
            maxMartingaleLevels,
            martingaleMultiplier: 2,
            martingaleStakeSequence: sequence,
            totalPlannedExposure,
            totalExposureFraction,
            stopLossAmount,
            takeProfitAmount,
            reasons
        };
    }
    grade(action, confidenceScore, blockerCount) {
        if (blockerCount > 0 || action === 'BLOCKED' || action === 'NO_BET')
            return 'REJECTED';
        if (confidenceScore >= 0.68 && (action === 'CONSERVATIVE_ENTRY' || action === 'MODERATE_ENTRY'))
            return 'RESEARCH_CANDIDATE';
        return 'WATCHLIST';
    }
    rationale(action, blockers, warnings) {
        if (blockers.length > 0)
            return `Decisão ${action}: bloqueadores institucionais ativos (${blockers.slice(0, 3).join('; ')}).`;
        if (warnings.length > 0)
            return `Decisão ${action}: evidência parcial com alertas (${warnings.slice(0, 3).join('; ')}).`;
        return `Decisão ${action}: hipótese aceita apenas para modo pesquisa, sem liberação de stake real.`;
    }
    reportId(context, rules) {
        const payload = JSON.stringify({ sessionId: context.sessionId, context, rules });
        return crypto_1.default.createHash('sha256').update(payload).digest('hex').slice(0, 24);
    }
}
exports.StrategyDecisionEngine = StrategyDecisionEngine;
class WarmupGateRule {
    constructor() {
        this.id = 'WARMUP_GATE';
    }
    evaluate(context) {
        const warmup = context.warmup;
        if (warmup.tableGate === 'NO_GO')
            return blocker(this.id, 'Warm-up classificou a mesa como NO_GO.', 0.92);
        if (warmup.completeness < 1)
            return blocker(this.id, 'Warm-up incompleto: exige as últimas 100 rodadas.', 0.88);
        const evidence = warmup.tableGate === 'GO_RESEARCH' ? 0.84 : 0.48;
        const risk = warmup.riskLabel === 'LOW' ? 0.15 : warmup.riskLabel === 'MODERATE' ? 0.38 : warmup.riskLabel === 'HIGH' ? 0.66 : 0.9;
        return warmup.tableGate === 'OBSERVE'
            ? warning(this.id, 'Warm-up em observação; mesa ainda não é candidata forte.', evidence, risk)
            : info(this.id, 'Warm-up aceito para pesquisa.', evidence, risk);
    }
}
class StrategySignalRule {
    constructor() {
        this.id = 'STRATEGY_SIGNAL';
    }
    evaluate(context) {
        const strategy = context.strategy;
        if (strategy.status === 'INSUFFICIENT_SAMPLE')
            return warning(this.id, 'Amostra insuficiente para StrategyEngine institucional.', 0.18, 0.62);
        if (strategy.status !== 'ALLOWED' || strategy.signalCount === 0)
            return warning(this.id, 'Nenhum sinal operacional ultrapassou limiar mínimo.', 0.24, 0.58);
        const evidence = clamp(strategy.maxSignalConfidence * 0.82 + Math.min(1, strategy.signalCount / 3) * 0.18);
        const risk = strategy.riskLevel === 'LOW' ? 0.18 : strategy.riskLevel === 'MEDIUM' ? 0.36 : strategy.riskLevel === 'HIGH' ? 0.64 : 0.86;
        return info(this.id, 'StrategyEngine encontrou sinal candidato, sujeito aos gates superiores.', evidence, risk);
    }
}
class BenchmarkEdgeRule {
    constructor() {
        this.id = 'BENCHMARK_EDGE';
    }
    evaluate(context) {
        const benchmark = context.benchmark;
        if (benchmark.verdict === 'UNAVAILABLE')
            return warning(this.id, 'Benchmark indisponível para esta amostra.', 0.2, 0.58);
        if (benchmark.verdict === 'REJECTED')
            return blocker(this.id, 'Estratégia falhou contra baselines institucionais.', 0.78);
        const evidence = clamp(benchmark.benchmarkScore * 0.48 + benchmark.beatRateByCandidate * 0.32 + Math.max(0, benchmark.relativeEdge) * 1.4);
        const risk = clamp(benchmark.baselineDominanceRisk * 0.65 + (benchmark.verdict === 'BENCHMARK_CANDIDATE' ? 0.12 : 0.38));
        return benchmark.verdict === 'BENCHMARK_CANDIDATE'
            ? info(this.id, 'Benchmark indica candidato acima dos baselines.', evidence, risk)
            : warning(this.id, 'Benchmark mantém hipótese em revisão.', evidence, risk);
    }
}
class CapitalSurvivalRule {
    constructor() {
        this.id = 'CAPITAL_SURVIVAL';
    }
    evaluate(context) {
        const capital = context.capital;
        if (capital.reviewStatus === 'UNAVAILABLE')
            return warning(this.id, 'Simulação de exposição de capital indisponível.', 0.22, 0.62);
        if (capital.reviewStatus === 'REJECTED' || capital.ruinProbability > 0.35 || capital.circuitBreakerCount >= 3) {
            return blocker(this.id, 'Risco de capital excede limites institucionais.', 0.9);
        }
        const evidence = capital.reviewStatus === 'CAPITAL_RESILIENT_CANDIDATE' ? 0.82 : 0.52;
        const risk = clamp(capital.ruinProbability * 0.52 + capital.worstDrawdown * 0.34 + capital.exposureSaturation * 0.14);
        return risk > 0.46
            ? warning(this.id, 'Exposição de capital exige throttling conservador.', evidence, risk)
            : info(this.id, 'Exposição de capital dentro da faixa de pesquisa.', evidence, risk);
    }
}
class MonteCarloRobustnessRule {
    constructor() {
        this.id = 'MONTE_CARLO_ROBUSTNESS';
    }
    evaluate(context) {
        const simulation = context.monteCarlo;
        if (simulation.reviewStatus === 'UNAVAILABLE')
            return warning(this.id, 'Monte Carlo v2 indisponível para esta amostra.', 0.2, 0.62);
        if (simulation.reviewStatus === 'REJECTED' || simulation.tailRisk === 'CRITICAL') {
            return blocker(this.id, 'Monte Carlo v2 rejeitou robustez sob cauda/reamostragem.', 0.88);
        }
        const evidence = clamp(simulation.robustnessScore * 0.74 + (1 - simulation.sequenceDependencyRisk) * 0.26);
        const risk = clamp(simulation.ruinProbability * 0.42 + simulation.p95MaxDrawdown * 0.36 + simulation.sequenceDependencyRisk * 0.22);
        return simulation.reviewStatus === 'ROBUSTNESS_CANDIDATE'
            ? info(this.id, 'Monte Carlo v2 indica hipótese robusta em modo pesquisa.', evidence, risk)
            : warning(this.id, 'Monte Carlo v2 mantém hipótese em revisão.', evidence, risk);
    }
}
class BankrollGuardRule {
    constructor() {
        this.id = 'BANKROLL_GUARD';
    }
    evaluate(context) {
        if (context.bankroll <= 0)
            return warning(this.id, 'Bankroll não informado; progressão Martingale fica indisponível.', 0.24, 0.58);
        const suggestedFraction = Math.max(0, context.strategy.suggestedFraction);
        const baseStake = context.bankroll * suggestedFraction;
        if (suggestedFraction > 0 && baseStake < 1) {
            return blocker(this.id, 'Stake sugerida não atinge o mínimo operacional de 1 unidade da banca.', 0.8);
        }
        const stopLossBudget = context.bankroll * 0.15;
        const sequence = boundedMartingaleSequence(baseStake, stopLossBudget, 3, 2);
        if (suggestedFraction > 0 && sequence.length === 0) {
            return blocker(this.id, 'Stake sugerida não cabe no orçamento de stop loss da banca.', 0.84);
        }
        const totalExposure = sum(sequence);
        const exposureFraction = context.bankroll > 0 ? totalExposure / context.bankroll : 0;
        if (exposureFraction > 0.15)
            return blocker(this.id, 'Progressão excede 15% da banca.', 0.82);
        if (suggestedFraction > 0 && sequence.length < 2) {
            return warning(this.id, 'Banca comporta apenas entrada seca, sem Martingale seguro.', 0.48, 0.46);
        }
        return info(this.id, 'Bankroll guard calculou progressão paper dentro do orçamento de risco.', 0.68, Math.min(0.34, exposureFraction));
    }
}
class GovernanceSafetyRule {
    constructor() {
        this.id = 'GOVERNANCE_SAFETY';
    }
    evaluate(context) {
        if (context.bankroll === 0)
            return warning(this.id, 'Bankroll não informado; decisão limitada a modo pesquisa.', 0.42, 0.48);
        if (context.strategy.suggestedFraction > 0.01)
            return blocker(this.id, 'Sizing sugerido excede limite conservador institucional.', 0.76);
        return info(this.id, 'Governança mantém execução em modo paper e exige liberação explícita do gate.', 0.72, 0.18);
    }
}
class StrategyDecisionRuleFactory {
    static defaultRules() {
        return [
            new WarmupGateRule(),
            new StrategySignalRule(),
            new BenchmarkEdgeRule(),
            new CapitalSurvivalRule(),
            new MonteCarloRobustnessRule(),
            new BankrollGuardRule(),
            new GovernanceSafetyRule()
        ];
    }
}
exports.StrategyDecisionRuleFactory = StrategyDecisionRuleFactory;
function info(ruleId, message, scoreContribution, riskContribution) {
    return { ruleId, severity: 'INFO', message, scoreContribution: round(clamp(scoreContribution)), riskContribution: round(clamp(riskContribution)) };
}
function warning(ruleId, message, scoreContribution, riskContribution) {
    return { ruleId, severity: 'WARNING', message, scoreContribution: round(clamp(scoreContribution)), riskContribution: round(clamp(riskContribution)) };
}
function blocker(ruleId, message, riskContribution) {
    return { ruleId, severity: 'BLOCKER', message, scoreContribution: 0, riskContribution: round(clamp(riskContribution)) };
}
function boundedMartingaleSequence(baseStake, exposureBudget, maxLevels, multiplier) {
    if (baseStake <= 0 || exposureBudget <= 0)
        return [];
    const sequence = [];
    for (let level = 0; level <= maxLevels; level += 1) {
        const nextStake = roundMoney(baseStake * multiplier ** level);
        const nextTotal = roundMoney(sum([...sequence, nextStake]));
        if (nextTotal > exposureBudget)
            break;
        sequence.push(nextStake);
    }
    return sequence;
}
function roundMoney(value) {
    if (!Number.isFinite(value))
        return 0;
    return Number(value.toFixed(2));
}
function sum(values) {
    return values.reduce((total, value) => total + value, 0);
}
function clamp(value) {
    if (!Number.isFinite(value))
        return 0;
    return Math.max(0, Math.min(1, value));
}
function round(value) {
    return Number(value.toFixed(6));
}
