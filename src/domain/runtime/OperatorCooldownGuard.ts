import { CooldownPolicy, CooldownReason, CooldownStatus, CooldownState, CooldownStateRepository } from './CooldownContracts';

export class OperatorCooldownGuard {
  private lockTimestampMs: number | null = null;
  private activeReason: CooldownReason | null = null;
  private requiredDurationMs: number = 0;

  constructor(
    private readonly policy: CooldownPolicy,
    private readonly repository?: CooldownStateRepository
  ) {
    this.restoreState();
  }

  private restoreState(): void {
    if (!this.repository) return;
    const savedState = this.repository.load();
    if (savedState) {
      this.lockTimestampMs = savedState.lockTimestampMs;
      this.activeReason = savedState.activeReason;
      this.requiredDurationMs = savedState.requiredDurationMs;
    }
  }

  public enforceLock(reason: CooldownReason, currentTimeMs: number): void {
    const newDuration = this.getDurationForReason(reason);
    const currentStatus = this.evaluate(currentTimeMs);
    
    if (currentStatus.isActive && currentStatus.remainingMs > newDuration) {
        return; // Mantém o bloqueio mais rigoroso
    }

    this.lockTimestampMs = currentTimeMs;
    this.activeReason = reason;
    this.requiredDurationMs = newDuration;

    // Persiste o estado O(1) apenas na mudança
    if (this.repository) {
      this.repository.save({
        lockTimestampMs: this.lockTimestampMs,
        activeReason: this.activeReason,
        requiredDurationMs: this.requiredDurationMs
      });
    }
  }

  public evaluate(currentTimeMs: number): CooldownStatus {
    if (this.lockTimestampMs === null) {
      return { isActive: false, remainingMs: 0, reason: null };
    }

    const elapsedMs = currentTimeMs - this.lockTimestampMs;
    const remainingMs = this.requiredDurationMs - elapsedMs;

    if (remainingMs <= 0) {
      this.clear();
      return { isActive: false, remainingMs: 0, reason: null };
    }

    return { isActive: true, remainingMs, reason: this.activeReason };
  }

  private clear(): void {
    this.lockTimestampMs = null;
    this.activeReason = null;
    this.requiredDurationMs = 0;
    if (this.repository) {
      this.repository.clear();
    }
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
