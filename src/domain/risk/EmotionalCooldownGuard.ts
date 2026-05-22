export type EmotionalCooldownState =
  | 'COOLDOWN_CLEAR'
  | 'COOLDOWN_REVIEW'
  | 'COOLDOWN_LOCKED';

export interface EmotionalCooldownInput {
  readonly consecutiveLosses: number;
  readonly attemptsAfterLoss: number;
  readonly millisecondsSinceLastLoss: number;
  readonly nowEpochMs: number;
}

export interface EmotionalCooldownPolicy {
  readonly reviewAfterConsecutiveLosses: number;
  readonly lockAfterConsecutiveLosses: number;
  readonly reviewAfterAttempts: number;
  readonly lockAfterAttempts: number;
  readonly recoveryWindowMs: number;
  readonly cooldownDurationMs: number;
}

export interface EmotionalCooldownResult {
  readonly state: EmotionalCooldownState;
  readonly lockedUntilEpochMs: number | null;
  readonly reason: string;
  readonly recommendedAction: string;
}

const DEFAULT_POLICY: EmotionalCooldownPolicy = {
  reviewAfterConsecutiveLosses: 2,
  lockAfterConsecutiveLosses: 3,
  reviewAfterAttempts: 2,
  lockAfterAttempts: 4,
  recoveryWindowMs: 5 * 60 * 1000,
  cooldownDurationMs: 15 * 60 * 1000,
};

/**
 * Detects emotionally unsafe operational patterns such as revenge attempts
 * after losses and repeated insistence inside a short recovery window.
 *
 * This guard does not know about betting, OCR, replay, or the runtime kernel.
 * It only classifies behavioral risk from bounded counters.
 *
 * Complexity:
 * - Time: O(1)
 * - Space: O(1)
 */
export class EmotionalCooldownGuard {
  public constructor(
    private readonly policy: EmotionalCooldownPolicy = DEFAULT_POLICY,
  ) {}

  public evaluate(input: EmotionalCooldownInput): EmotionalCooldownResult {
    this.assertValidInput(input);

    const insideRecoveryWindow =
      input.millisecondsSinceLastLoss <= this.policy.recoveryWindowMs;

    if (
      insideRecoveryWindow &&
      (
        input.consecutiveLosses >= this.policy.lockAfterConsecutiveLosses ||
        input.attemptsAfterLoss >= this.policy.lockAfterAttempts
      )
    ) {
      return {
        state: 'COOLDOWN_LOCKED',
        lockedUntilEpochMs: input.nowEpochMs + this.policy.cooldownDurationMs,
        reason: 'Padrão de insistência após perda detectado.',
        recommendedAction: 'Pausar a sessão. Respirar, revisar a banca e evitar recuperar prejuízo no impulso.',
      };
    }

    if (
      insideRecoveryWindow &&
      (
        input.consecutiveLosses >= this.policy.reviewAfterConsecutiveLosses ||
        input.attemptsAfterLoss >= this.policy.reviewAfterAttempts
      )
    ) {
      return {
        state: 'COOLDOWN_REVIEW',
        lockedUntilEpochMs: null,
        reason: 'Atenção: sinais iniciais de operação emocional.',
        recommendedAction: 'Reduzir ritmo. Aguardar nova confirmação antes de qualquer entrada.',
      };
    }

    return {
      state: 'COOLDOWN_CLEAR',
      lockedUntilEpochMs: null,
      reason: 'Sem padrão emocional crítico detectado.',
      recommendedAction: 'Manter disciplina operacional e respeitar os limites da banca.',
    };
  }

  private assertValidInput(input: EmotionalCooldownInput): void {
    if (!Number.isInteger(input.consecutiveLosses) || input.consecutiveLosses < 0) {
      throw new Error('consecutiveLosses must be a non-negative integer');
    }

    if (!Number.isInteger(input.attemptsAfterLoss) || input.attemptsAfterLoss < 0) {
      throw new Error('attemptsAfterLoss must be a non-negative integer');
    }

    if (
      !Number.isFinite(input.millisecondsSinceLastLoss) ||
      input.millisecondsSinceLastLoss < 0
    ) {
      throw new Error('millisecondsSinceLastLoss must be a non-negative finite number');
    }

    if (!Number.isInteger(input.nowEpochMs) || input.nowEpochMs <= 0) {
      throw new Error('nowEpochMs must be a positive integer');
    }
  }
}
