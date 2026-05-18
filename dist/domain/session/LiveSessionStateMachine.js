"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LiveSessionStateMachine = void 0;
/**
 * Pure state machine for live roulette sessions.
 *
 * The machine is intentionally stateless: all decisions are derived from a compact
 * snapshot, which keeps calls idempotent and safe to repeat after process restarts.
 * Complexity is O(1) time and O(1) memory per evaluation.
 */
class LiveSessionStateMachine {
    constructor(options) {
        this.warmupSize = Math.max(1, Math.trunc(options.warmupSize));
        this.decisionWindowSize = Math.max(this.warmupSize, Math.trunc(options.decisionWindowSize));
        this.cooldownSpins = Math.max(0, Math.trunc(options.cooldownSpins ?? 3));
        this.entropyCooldownThreshold = clamp(options.entropyCooldownThreshold ?? 0.58);
        this.concentrationCooldownThreshold = clamp(options.concentrationCooldownThreshold ?? 0.34);
    }
    evaluate(input) {
        const spinsUntilWarmup = Math.max(0, this.warmupSize - input.roundCount);
        const spinsUntilDecision = Math.max(0, this.decisionWindowSize - input.roundCount);
        if (input.status === 'BLOCKED') {
            return this.frame('BLOCKED', 'REJECT_EVENT', spinsUntilWarmup, spinsUntilDecision, 0, 'Sessão bloqueada por validação do runtime.');
        }
        if (spinsUntilWarmup > 0) {
            return this.frame('COLLECTING_WARMUP', 'INGEST_ROUND', spinsUntilWarmup, spinsUntilDecision, 0, `Coletar mais ${spinsUntilWarmup} rodada(s) para completar o warm-up.`);
        }
        if (this.shouldCooldown(input.rolling)) {
            return this.frame('COOLDOWN', 'WAIT_COOLDOWN', 0, Math.max(1, this.cooldownSpins), this.cooldownSpins, 'Volatilidade/concentração recente exige cooldown antes de nova decisão.');
        }
        if (spinsUntilDecision > 0) {
            return this.frame('WARMUP_COMPLETE', 'INGEST_ROUND', 0, spinsUntilDecision, 0, `Warm-up completo; coletar mais ${spinsUntilDecision} rodada(s) para janela de decisão.`);
        }
        return this.frame('DECISION_READY', 'EVALUATE_DECISION', 0, 0, 0, 'Janela live pronta para avaliação determinística.');
    }
    shouldCooldown(rolling) {
        if (rolling.windowSize < 16)
            return false;
        return rolling.normalizedEntropy <= this.entropyCooldownThreshold || rolling.maxNumberConcentration >= this.concentrationCooldownThreshold;
    }
    frame(phase, nextAction, spinsUntilWarmup, spinsUntilDecision, cooldownRemainingSpins, reason) {
        return {
            phase,
            nextAction,
            spinsUntilWarmup,
            spinsUntilDecision,
            cooldownRemainingSpins,
            decisionWindowSize: this.decisionWindowSize,
            reason
        };
    }
}
exports.LiveSessionStateMachine = LiveSessionStateMachine;
function clamp(value) {
    if (!Number.isFinite(value))
        return 0;
    return Math.min(1, Math.max(0, value));
}
