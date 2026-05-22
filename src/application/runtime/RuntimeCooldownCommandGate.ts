import {
  EmotionalCooldownGuard,
  EmotionalCooldownResult,
} from '../../domain/risk';

export type RuntimeCooldownCommandType =
  | 'ROUND'
  | 'LOSS'
  | 'WIN'
  | 'STATUS'
  | 'REPORT'
  | 'QUIT'
  | 'OTHER';

export type RuntimeCooldownCommandVerdict =
  | 'ALLOW'
  | 'REVIEW'
  | 'BLOCK'
  | 'RESET';

export interface RuntimeCooldownCommandInput {
  readonly commandType: RuntimeCooldownCommandType;
  readonly nowEpochMs: number;
}

export interface RuntimeCooldownCommandResult {
  readonly verdict: RuntimeCooldownCommandVerdict;
  readonly cooldown: EmotionalCooldownResult;
  readonly consecutiveLosses: number;
  readonly attemptsAfterLoss: number;
  readonly reason: string;
}

/**
 * Application-level adapter for emotional cooldown enforcement.
 *
 * It is intentionally isolated from RuntimeKernel internals, so it can be
 * wired into CLI, REPL, HUD, or future adapters without depending on the
 * current shape of the kernel implementation.
 *
 * Complexity:
 * - Time: O(1)
 * - Space: O(1)
 */
export class RuntimeCooldownCommandGate {
  private consecutiveLosses = 0;
  private attemptsAfterLoss = 0;
  private lastLossEpochMs: number | null = null;
  private lockedUntilEpochMs: number | null = null;

  public constructor(
    private readonly guard: EmotionalCooldownGuard = new EmotionalCooldownGuard(),
  ) {}

  public evaluate(
    input: RuntimeCooldownCommandInput,
  ): RuntimeCooldownCommandResult {
    this.assertValidInput(input);

    if (input.commandType === 'WIN') {
      this.consecutiveLosses = 0;
      this.attemptsAfterLoss = 0;
      this.lastLossEpochMs = null;
      this.lockedUntilEpochMs = null;

      return {
        verdict: 'RESET',
        cooldown: this.clearResult(),
        consecutiveLosses: this.consecutiveLosses,
        attemptsAfterLoss: this.attemptsAfterLoss,
        reason: 'Resultado positivo registrado. Cooldown emocional resetado.',
      };
    }

    if (input.commandType === 'LOSS') {
      this.consecutiveLosses += 1;
      this.lastLossEpochMs = input.nowEpochMs;

      const cooldown = this.evaluateCooldown(input.nowEpochMs);

      return {
        verdict: this.toVerdict(cooldown),
        cooldown,
        consecutiveLosses: this.consecutiveLosses,
        attemptsAfterLoss: this.attemptsAfterLoss,
        reason: cooldown.reason,
      };
    }

    if (this.isLocked(input.nowEpochMs) && this.isOperationalCommand(input.commandType)) {
      return {
        verdict: 'BLOCK',
        cooldown: {
          state: 'COOLDOWN_LOCKED',
          lockedUntilEpochMs: this.lockedUntilEpochMs,
          reason: 'Cooldown emocional ativo.',
          recommendedAction: 'Aguardar o fim da pausa antes de realizar nova entrada.',
        },
        consecutiveLosses: this.consecutiveLosses,
        attemptsAfterLoss: this.attemptsAfterLoss,
        reason: 'Cooldown emocional ativo. Nova entrada bloqueada para proteger a banca.',
      };
    }

    if (input.commandType === 'ROUND' && this.lastLossEpochMs !== null) {
      this.attemptsAfterLoss += 1;

      const cooldown = this.evaluateCooldown(input.nowEpochMs);

      return {
        verdict: this.toVerdict(cooldown),
        cooldown,
        consecutiveLosses: this.consecutiveLosses,
        attemptsAfterLoss: this.attemptsAfterLoss,
        reason: cooldown.reason,
      };
    }

    return {
      verdict: 'ALLOW',
      cooldown: this.clearResult(),
      consecutiveLosses: this.consecutiveLosses,
      attemptsAfterLoss: this.attemptsAfterLoss,
      reason: 'Comando permitido. Nenhum cooldown emocional ativo.',
    };
  }

  public snapshot(): {
    readonly consecutiveLosses: number;
    readonly attemptsAfterLoss: number;
    readonly lastLossEpochMs: number | null;
    readonly lockedUntilEpochMs: number | null;
  } {
    return {
      consecutiveLosses: this.consecutiveLosses,
      attemptsAfterLoss: this.attemptsAfterLoss,
      lastLossEpochMs: this.lastLossEpochMs,
      lockedUntilEpochMs: this.lockedUntilEpochMs,
    };
  }

  private evaluateCooldown(nowEpochMs: number): EmotionalCooldownResult {
    const millisecondsSinceLastLoss = this.lastLossEpochMs === null
      ? Number.MAX_SAFE_INTEGER
      : Math.max(0, nowEpochMs - this.lastLossEpochMs);

    const result = this.guard.evaluate({
      consecutiveLosses: this.consecutiveLosses,
      attemptsAfterLoss: this.attemptsAfterLoss,
      millisecondsSinceLastLoss,
      nowEpochMs,
    });

    if (result.state === 'COOLDOWN_LOCKED') {
      this.lockedUntilEpochMs = result.lockedUntilEpochMs;
    }

    return result;
  }

  private toVerdict(
    cooldown: EmotionalCooldownResult,
  ): RuntimeCooldownCommandVerdict {
    if (cooldown.state === 'COOLDOWN_LOCKED') {
      return 'BLOCK';
    }

    if (cooldown.state === 'COOLDOWN_REVIEW') {
      return 'REVIEW';
    }

    return 'ALLOW';
  }

  private isLocked(nowEpochMs: number): boolean {
    if (this.lockedUntilEpochMs === null) {
      return false;
    }

    if (nowEpochMs >= this.lockedUntilEpochMs) {
      this.lockedUntilEpochMs = null;
      return false;
    }

    return true;
  }

  private isOperationalCommand(commandType: RuntimeCooldownCommandType): boolean {
    return commandType === 'ROUND' || commandType === 'LOSS' || commandType === 'OTHER';
  }

  private clearResult(): EmotionalCooldownResult {
    return {
      state: 'COOLDOWN_CLEAR',
      lockedUntilEpochMs: null,
      reason: 'Sem padrão emocional crítico detectado.',
      recommendedAction: 'Manter disciplina operacional e respeitar os limites da banca.',
    };
  }

  private assertValidInput(input: RuntimeCooldownCommandInput): void {
    if (!Number.isInteger(input.nowEpochMs) || input.nowEpochMs <= 0) {
      throw new Error('nowEpochMs must be a positive integer');
    }
  }
}
