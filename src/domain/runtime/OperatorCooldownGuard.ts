import { CooldownPolicy, CooldownReason, CooldownStatus } from './CooldownContracts';

export class OperatorCooldownGuard {
  private lockTimestampMs: number | null = null;
  private activeReason: CooldownReason | null = null;
  private requiredDurationMs: number = 0;

  constructor(private readonly policy: CooldownPolicy) {}

  /**
   * Impõe ou atualiza uma penalidade temporal.
   * O(1) - Mutação controlada de estado interno.
   */
  public enforceLock(reason: CooldownReason, currentTimeMs: number): void {
    // Idempotência e Proteção contra By-Pass: 
    // Se já houver um lock ativo, só subscreve se o novo for mais rigoroso ou prolongar o tempo total.
    const newDuration = this.getDurationForReason(reason);
    
    const currentStatus = this.evaluate(currentTimeMs);
    if (currentStatus.isActive && currentStatus.remainingMs > newDuration) {
        // Ignora a nova punição se a atual for mais longa (Evita que o operador force um erro menor para reduzir a pena)
        return;
    }

    this.lockTimestampMs = currentTimeMs;
    this.activeReason = reason;
    this.requiredDurationMs = newDuration;
  }

  /**
   * Avalia passivamente o estado do bloqueio.
   * Puro, determinístico, O(1), Zero Alocação Dinâmica se inativo.
   */
  public evaluate(currentTimeMs: number): CooldownStatus {
    if (this.lockTimestampMs === null) {
      return { isActive: false, remainingMs: 0, reason: null };
    }

    const elapsedMs = currentTimeMs - this.lockTimestampMs;
    const remainingMs = this.requiredDurationMs - elapsedMs;

    if (remainingMs <= 0) {
      // Cooldown Expirou naturalmente
      this.clear();
      return { isActive: false, remainingMs: 0, reason: null };
    }

    return { 
      isActive: true, 
      remainingMs, 
      reason: this.activeReason 
    };
  }

  private clear(): void {
    this.lockTimestampMs = null;
    this.activeReason = null;
    this.requiredDurationMs = 0;
  }

  private getDurationForReason(reason: CooldownReason): number {
    switch (reason) {
      case CooldownReason.STOP_LOSS: return this.policy.stopLossMs;
      case CooldownReason.DRAWDOWN_VELOCITY: return this.policy.drawdownVelocityMs;
      case CooldownReason.PARADIGM_BREAK: return this.policy.paradigmBreakMs;
      case CooldownReason.MANUAL_EMERGENCY: return this.policy.manualEmergencyMs;
      default: return 0;
    }
  }
}
