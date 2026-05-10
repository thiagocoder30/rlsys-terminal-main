import type { LiveSessionSnapshot, LiveSessionStatus } from './LiveSessionRuntime';

export type LiveSessionPhase = 'COLLECTING_WARMUP' | 'WARMUP_COMPLETE' | 'DECISION_READY' | 'COOLDOWN' | 'BLOCKED';
export type LiveSessionNextAction = 'INGEST_ROUND' | 'EVALUATE_DECISION' | 'WAIT_COOLDOWN' | 'REJECT_EVENT';

export interface LiveSessionStateMachineOptions {
  readonly warmupSize: number;
  readonly decisionWindowSize: number;
  readonly cooldownSpins?: number;
  readonly entropyCooldownThreshold?: number;
  readonly concentrationCooldownThreshold?: number;
}

export interface LiveSessionControlFrame {
  readonly phase: LiveSessionPhase;
  readonly nextAction: LiveSessionNextAction;
  readonly spinsUntilWarmup: number;
  readonly spinsUntilDecision: number;
  readonly cooldownRemainingSpins: number;
  readonly decisionWindowSize: number;
  readonly reason: string;
}

interface ControlInput {
  readonly status: LiveSessionStatus;
  readonly roundCount: number;
  readonly rolling: LiveSessionSnapshot['rolling'];
}

/**
 * Pure state machine for live roulette sessions.
 *
 * The machine is intentionally stateless: all decisions are derived from a compact
 * snapshot, which keeps calls idempotent and safe to repeat after process restarts.
 * Complexity is O(1) time and O(1) memory per evaluation.
 */
export class LiveSessionStateMachine {
  private readonly warmupSize: number;
  private readonly decisionWindowSize: number;
  private readonly cooldownSpins: number;
  private readonly entropyCooldownThreshold: number;
  private readonly concentrationCooldownThreshold: number;

  public constructor(options: LiveSessionStateMachineOptions) {
    this.warmupSize = Math.max(1, Math.trunc(options.warmupSize));
    this.decisionWindowSize = Math.max(this.warmupSize, Math.trunc(options.decisionWindowSize));
    this.cooldownSpins = Math.max(0, Math.trunc(options.cooldownSpins ?? 3));
    this.entropyCooldownThreshold = clamp(options.entropyCooldownThreshold ?? 0.58);
    this.concentrationCooldownThreshold = clamp(options.concentrationCooldownThreshold ?? 0.34);
  }

  public evaluate(input: ControlInput): LiveSessionControlFrame {
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

  private shouldCooldown(rolling: LiveSessionSnapshot['rolling']): boolean {
    if (rolling.windowSize < 16) return false;
    return rolling.normalizedEntropy <= this.entropyCooldownThreshold || rolling.maxNumberConcentration >= this.concentrationCooldownThreshold;
  }

  private frame(
    phase: LiveSessionPhase,
    nextAction: LiveSessionNextAction,
    spinsUntilWarmup: number,
    spinsUntilDecision: number,
    cooldownRemainingSpins: number,
    reason: string
  ): LiveSessionControlFrame {
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

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
