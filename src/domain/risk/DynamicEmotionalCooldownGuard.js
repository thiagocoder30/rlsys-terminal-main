'use strict';

/**
 * Motor de Cooldown com persistência de estado e proteção contra evasão.
 */
class DynamicEmotionalCooldownGuard {
  constructor(initialBankroll, hydratedState = null) {
    this.initialBankroll = initialBankroll;
    this.currentBankroll = initialBankroll;
    this.peakBankroll = initialBankroll;
    this.consecutiveLosses = 0;
    
    this.lockUntil = 0;
    this.lockReason = '';
    this.isSessionEnded = false;
    
    // Parâmetros de Riscos Fixos (Invioláveis)
    this.stepPercent = 0.02; 
    this.globalTargetPercent = 0.10; 
    
    this.milestoneStep = this.initialBankroll * this.stepPercent;
    this.globalStopWinTarget = this.initialBankroll * (1 + this.globalTargetPercent);

    // Se houver estado anterior salvo em disco, restaura a máquina de estados
    if (hydratedState) {
      this.currentBankroll = hydratedState.currentBankroll ?? initialBankroll;
      this.peakBankroll = hydratedState.peakBankroll ?? this.currentBankroll;
      this.consecutiveLosses = hydratedState.consecutiveLosses ?? 0;
      this.lockUntil = hydratedState.lockUntil ?? 0;
      this.lockReason = hydratedState.lockReason ?? '';
      this.isSessionEnded = hydratedState.isSessionEnded ?? false;
    }
    
    this.calculateNextMilestone();
  }

  calculateNextMilestone() {
    let currentStep = this.initialBankroll + this.milestoneStep;
    while (currentStep <= this.currentBankroll && currentStep < this.globalStopWinTarget) {
      currentStep += this.milestoneStep;
    }
    this.nextMilestone = currentStep;
  }

  registerOutcome(isWin, amount) {
    if (this.isSessionEnded) return { status: 'SESSION_ENDED' };
    
    if (this.isLocked()) {
      this.lockUntil += 120000; // Penalidade por tentar burlar/operar travado
      return { status: 'PENALTY_APPLIED' };
    }

    this.currentBankroll = amount;
    if (amount > this.peakBankroll) this.peakBankroll = amount;

    if (!isWin) {
      this.consecutiveLosses++;
      if (this.consecutiveLosses >= 2) {
        this.triggerLock(10 * 60 * 1000, 'SEQUÊNCIA DE PERDAS (Prevenção de Tilt)');
        this.consecutiveLosses = 0; 
      }
    } else {
      this.consecutiveLosses = 0;
      
      if (this.currentBankroll >= this.globalStopWinTarget) {
        this.isSessionEnded = true;
        this.triggerLock(24 * 60 * 60 * 1000, `GLOBAL STOP WIN ATINGIDO (+10%). Sessão Encerrada.`);
        return;
      }
      
      if (this.currentBankroll >= this.nextMilestone) {
        this.triggerLock(15 * 60 * 1000, `DEGRAU ATINGIDO (+2%). Proteja o Lucro.`);
        this.calculateNextMilestone(); 
      }
    }
  }

  triggerLock(durationMs, reason) {
    this.lockUntil = Date.now() + durationMs;
    this.lockReason = reason;
  }

  isLocked() {
    return Date.now() < this.lockUntil;
  }

  getRemainingStatus() {
    if (!this.isLocked()) return null;
    const remainingMs = this.lockUntil - Date.now();
    
    if (this.isSessionEnded) {
      return { reason: this.lockReason, time: 'SESSÃO FINALIZADA HOJE' };
    }

    const minutes = Math.floor(remainingMs / 60000);
    const seconds = Math.floor((remainingMs % 60000) / 1000);
    return {
      reason: this.lockReason,
      time: `${minutes}m ${seconds}s`
    };
  }

  exportState() {
    return {
      initialBankroll: this.initialBankroll,
      currentBankroll: this.currentBankroll,
      peakBankroll: this.peakBankroll,
      consecutiveLosses: this.consecutiveLosses,
      lockUntil: this.lockUntil,
      lockReason: this.lockReason,
      isSessionEnded: this.isSessionEnded
    };
  }
}

module.exports = { DynamicEmotionalCooldownGuard };
